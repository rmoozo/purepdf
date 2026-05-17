export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { paymentId } = req.body;
  
  try {
    const response = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${process.env.PI_NETWORK_API_KEY}`
        }
      }
    );
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}