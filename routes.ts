import { withMesh } from 'x402-mesh/next';

export const POST = withMesh({
  category: 'email-validation',
  self: {
    vendor_id: 'your-slug',
    name: 'Your API',
    price: { amount_cents: 3, currency: 'USD', unit: 'per_call' },
  },
  alternatives: 'auto',          // fetch peers from the registry
  handler: async (req) => {
    return Response.json({ ok: true }); // runs only after payment
  },
});
