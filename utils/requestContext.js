const normalizeIp = (ip) => {
	if (!ip) return "";
	if (ip.startsWith("::ffff:")) return ip.replace("::ffff:", "");
	if (ip === "::1") return "127.0.0.1";
	return ip;
};

const isPrivateIp = (ip) => {
	const normalized = normalizeIp(ip);
	if (!normalized) return true;

	if (normalized === "127.0.0.1") return true;
	if (normalized.startsWith("10.")) return true;
	if (normalized.startsWith("192.168.")) return true;
	if (normalized.startsWith("172.")) {
		const secondOctet = parseInt(normalized.split(".")[1], 10);
		if (secondOctet >= 16 && secondOctet <= 31) return true;
	}

	// IPv6 private ranges
	if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
	if (normalized.startsWith("fe80")) return true;

	return false;
};

const fetchLocation = async (ipAddress) => {
	if (!ipAddress || isPrivateIp(ipAddress)) {
		return null;
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 2000);

	try {
		const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
			signal: controller.signal,
		});

		if (!response.ok) {
			return null;
		}

		const data = await response.json();
		return {
			city: data.city,
			region: data.region,
			country: data.country_name,
			lat: data.latitude,
			lng: data.longitude,
		};
	} catch (error) {
		return null;
	} finally {
		clearTimeout(timeoutId);
	}
};

export const buildRequestContext = async (req) => {
	const forwardedFor = req.headers["x-forwarded-for"];
	const forwardedIp = Array.isArray(forwardedFor)
		? forwardedFor[0]
		: forwardedFor?.split(",").map((ip) => ip.trim())[0];

	const ipAddress = normalizeIp(forwardedIp || req.ip || req.connection?.remoteAddress || "");
	const userAgent = req.headers["user-agent"] || "";
	const location = await fetchLocation(ipAddress);

	return {
		ipAddress,
		userAgent,
		location,
	};
};

export const isPrivateRequestIp = (ip) => isPrivateIp(ip);
