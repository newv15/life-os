import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabase, getCurrentUserId } from '@/lib/db/server'
import {
  CSV_TABLES,
  exportEverything,
  selectTable,
  toCSV,
  type ExportTable,
} from '@/lib/services/export'
import { todayISO } from '@/lib/utils/date'

/**
 * Your data, on your disk, in one click.
 *
 * Deliberately a plain GET behind the session rather than a Server Action: a
 * download is the one thing the browser does better than we can, and the file
 * has to arrive as a file. It uses the session client, so RLS applies here on
 * top of the explicit owner filter - this is a user-facing route, not a
 * service-role one.
 */
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const db = await createServerSupabase()
  const params = request.nextUrl.searchParams
  const format = params.get('format') ?? 'json'
  const stamp = todayISO()

  if (format === 'csv') {
    const requested = params.get('table')
    const known = CSV_TABLES.find((entry) => entry.table === requested)
    if (!known) {
      return NextResponse.json({ error: 'Tabella non esportabile' }, { status: 400 })
    }

    const rows = await selectTable(db, userId, known.table as ExportTable)

    return new NextResponse(toCSV(rows), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="life-os-${known.table}-${stamp}.csv"`,
        'cache-control': 'no-store',
      },
    })
  }

  const dump = await exportEverything(db, userId)

  return new NextResponse(JSON.stringify(dump, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="life-os-${stamp}.json"`,
      'cache-control': 'no-store',
    },
  })
}
