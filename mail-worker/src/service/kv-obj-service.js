const kvObjService = {

	async putObj(c, key, content, metadata) {
		await c.env.kv.put(key, content, { metadata: metadata });
	},

	async deleteObj(c, keys) {

		if (typeof keys === 'string') {
			keys = [keys];
		}

		if (keys.length === 0) {
			return;
		}

		await Promise.all(keys.map( key => c.env.kv.delete(key)));
	},

	async getObj(c, key) {
		const obj = await c.env.kv.getWithMetadata(key, { type: "arrayBuffer"});
		if (!obj.value) {
			return null;
		}

		const contentType = String(obj.metadata?.contentType || '').toLowerCase();
		const safeInline = key.startsWith('static/') && ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(contentType);
		return new Response(obj.value, {
			headers: {
				'Content-Type': safeInline ? contentType : 'application/octet-stream',
				'Content-Disposition': safeInline ? 'inline' : (obj.metadata?.contentDisposition || 'attachment'),
				'Cache-Control': obj.metadata?.cacheControl || 'private, max-age=300',
				'Content-Security-Policy': "sandbox; default-src 'none'",
				'X-Content-Type-Options': 'nosniff',
				'Referrer-Policy': 'no-referrer'
			}
		});
	},

	async toObjResp(c, key) {

		return await this.getObj(c, key);

	}

};

export default kvObjService;
