import { getCurrentUser } from '@/lib/auth';
import { listOrders } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const all = listOrders();

    if (user && user.role === 'DELIVERY_AGENT') {
      const agentDeliveries = all.filter(o => 
        (o.deliveryAgentId && o.deliveryAgentId === user.agentId) || (o.deliveryAgentName && o.deliveryAgentName === user.name)
      );
      return Response.json({ deliveries: agentDeliveries });
    }

    return Response.json({ deliveries: all });
  } catch (e) {
    return Response.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
  }
}
