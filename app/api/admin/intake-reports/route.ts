import { listAllCustomerIntakeReports, getCustomerIntakeReport } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get('caseId');

    if (caseId) {
      const report = getCustomerIntakeReport(caseId);
      return Response.json({ report });
    }

    const reports = listAllCustomerIntakeReports();
    return Response.json({ reports });
  } catch {
    return Response.json({ error: 'Failed to retrieve intake reports' }, { status: 500 });
  }
}
