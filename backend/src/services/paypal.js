export function createPaypalClient({ base, clientId, clientSecret, fetch = globalThis.fetch, log = console }) {
	async function accessToken() {
		const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
		const res = await fetch(`${base}/v1/oauth2/token`, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${auth}`,
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: 'grant_type=client_credentials'
		});

		if (!res.ok) {
			log.error(`Paypal access token error: [${res.status}] ${await res.text()}`);
			return null;
		}
		return (await res.json()).access_token;
	}

	async function call(path, body) {
		const token = await accessToken();
		const res = await fetch(`${base}${path}`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: body ? JSON.stringify(body) : undefined
		});
		return { ok: res.ok, status: res.status, data: await res.json() };
	}

	return {
		createOrder: (amount) =>
			call('/v2/checkout/orders', {
				intent: 'CAPTURE',
				purchase_units: [{ amount: { currency_code: 'EUR', value: amount } }]
			}),
		captureOrder: (orderId) => call(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`)
	};
}

export function extractCaptureInfo(data) {
	return {
		transactionId: data?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null,
		orderId: data?.id,
		payer: data?.payer?.payer_id ?? null,
		status: data?.status
	};
}
