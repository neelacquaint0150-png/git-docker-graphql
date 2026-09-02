export async function sendSMSViaHttpSMS(toPhone, message) {
  const apiKey = process.env.HTTPSMS_API_KEY;
  const fromPhone = process.env.HTTPSMS_FROM_NUMBER;

  if (!apiKey || apiKey === 'your_httpsms_api_key_here') {
    console.log(`\n========================================`);
    console.log(`[DEV MODE] HttpSMS API key missing.`);
    console.log(`Simulated SMS to ${toPhone}: "${message}"`);
    console.log(`========================================\n`);
    return { status: 'simulated' };
  }

  const response = await fetch('https://api.httpsms.com/v1/messages/send', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromPhone,
      to: toPhone,
      content: message,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage =
      typeof data === 'object'
        ? (data.from && data.from[0] + data.from[1]) || data.message || data.error || JSON.stringify(data)
        : data;
    console.error('HttpSMS Dispatch Warning:', errorMessage);
  }

  return data;
}