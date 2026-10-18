import { OEM as e, PSM as t, createWorker as n } from "tesseract.js";
//#region src/image/image-preprocessor.ts
var r = {
	grayscale: !0,
	contrast: 1.2,
	maxDimension: 2e3
};
function i(e, t = {}) {
	let n = {
		...r,
		...t
	};
	if (!Number.isFinite(n.contrast) || n.contrast <= 0) throw RangeError("El contraste debe ser mayor que cero.");
	if (!Number.isFinite(n.maxDimension) || n.maxDimension < 1) throw RangeError("maxDimension debe ser mayor que cero.");
	let { image: i, width: o, height: s } = e, c = Math.min(1, n.maxDimension / Math.max(o, s)), l = Math.max(1, Math.round(o * c)), u = Math.max(1, Math.round(s * c)), d = document.createElement("canvas");
	d.width = l, d.height = u;
	let f = d.getContext("2d", { willReadFrequently: !0 });
	if (!f) throw Error("No se pudo crear el contexto de imagen.");
	if (f.drawImage(i, 0, 0, l, u), n.grayscale || n.contrast !== 1) {
		let e = f.getImageData(0, 0, l, u), t = e.data;
		for (let e = 0; e < t.length; e += 4) {
			let r = t[e], i = t[e + 1], o = t[e + 2];
			if (n.grayscale) {
				let e = .299 * r + .587 * i + .114 * o;
				r = e, i = e, o = e;
			}
			t[e] = a((r - 128) * n.contrast + 128), t[e + 1] = a((i - 128) * n.contrast + 128), t[e + 2] = a((o - 128) * n.contrast + 128);
		}
		f.putImageData(e, 0, 0);
	}
	return {
		canvas: d,
		width: l,
		height: u
	};
}
function a(e) {
	return Math.max(0, Math.min(255, Math.round(e)));
}
//#endregion
//#region src/image/image-loader.ts
var o = /* @__PURE__ */ new Set([
	"image/jpeg",
	"image/png",
	"image/webp"
]), s = {
	minWidth: 300,
	minHeight: 200,
	maxFileSizeMB: 15
};
async function c(e, t = {}) {
	if (typeof window > "u" || typeof Image > "u") throw Error("El cargador de imágenes requiere un navegador.");
	if (!(e instanceof File)) throw TypeError("Debes proporcionar un archivo válido.");
	let n = {
		...s,
		...t
	};
	if (!o.has(e.type)) throw TypeError("Formato no admitido. Utiliza JPEG, PNG o WebP.");
	if (e.size === 0) throw Error("El archivo está vacío.");
	if (e.size > n.maxFileSizeMB * 1024 * 1024) throw Error(`La imagen supera el límite de ${n.maxFileSizeMB} MB.`);
	let r = URL.createObjectURL(e);
	try {
		let t = await l(r);
		if (t.naturalWidth < n.minWidth || t.naturalHeight < n.minHeight) throw Error(`La imagen debe medir al menos ${n.minWidth} × ${n.minHeight} píxeles.`);
		return {
			image: t,
			width: t.naturalWidth,
			height: t.naturalHeight,
			mimeType: e.type
		};
	} finally {
		URL.revokeObjectURL(r);
	}
}
function l(e) {
	return new Promise((t, n) => {
		let r = new Image();
		r.onload = () => t(r), r.onerror = () => {
			n(/* @__PURE__ */ Error("No se pudo decodificar la imagen. El archivo podría estar dañado."));
		}, r.src = e;
	});
}
//#endregion
//#region src/image/processed-image-adapter.ts
function u(e) {
	return e.canvas;
}
function d(e) {
	return {
		canvas: e,
		width: e.width,
		height: e.height
	};
}
//#endregion
//#region src/ocr/ocr-engine.ts
var f = {
	single_line: t.SINGLE_LINE,
	single_block: t.SINGLE_BLOCK,
	single_word: t.SINGLE_WORD
}, p = class {
	lang;
	workers = /* @__PURE__ */ new Map();
	constructor(e = "spa") {
		this.lang = e;
	}
	getWorker(t) {
		let r = this.workers.get(t);
		return r || (r = t === "raw" ? n(this.lang, e.LSTM_ONLY, {}, {
			load_system_dawg: "0",
			load_freq_dawg: "0"
		}) : n(this.lang), this.workers.set(t, r)), r;
	}
	async recognize(e, t = {}) {
		let n = await this.getWorker(t.noDictionary ? "raw" : "default");
		await n.setParameters({
			tessedit_pageseg_mode: f[t.pageSegMode ?? "single_line"],
			tessedit_char_whitelist: t.whitelist ?? "",
			preserve_interword_spaces: "1"
		});
		let { data: r } = await n.recognize(u(e));
		return {
			text: r.text,
			confidence: r.confidence
		};
	}
	async dispose() {
		let e = [...this.workers.values()];
		this.workers.clear();
		for (let t of e) try {
			await (await t).terminate();
		} catch {}
	}
};
//#endregion
//#region src/ocr/regions.ts
function m(e, t, n) {
	return {
		x: e.left / t,
		y: e.top / n,
		width: (e.right - e.left) / t,
		height: (e.bottom - e.top) / n
	};
}
var h = [
	"title1",
	"title2",
	"low_title",
	"university",
	"code",
	"dni",
	"lastname1",
	"lastname2",
	"name",
	"faculty",
	"degree",
	"admission_period",
	"day_expiration",
	"month_expiration",
	"year_expiration"
], g = {
	width: 986,
	height: 621
}, _ = "0123456789", v = /^(c[oó]digo|dni|apellidos|nombres|facultad|carrera)\s*:?\s*/i;
function y(e, t, n, r) {
	return m({
		left: e,
		top: t,
		right: n,
		bottom: r
	}, g.width, g.height);
}
var b = [
	{
		key: "title1",
		region: y(148, 38, 345, 64),
		kind: "text",
		required: !1,
		psm: "single_line",
		minConfidence: 50,
		stripPunctuation: !0
	},
	{
		key: "title2",
		region: y(148, 64, 800, 94),
		kind: "text",
		required: !1,
		psm: "single_line",
		minConfidence: 50,
		stripPunctuation: !0
	},
	{
		key: "university",
		region: y(148, 103, 230, 134),
		kind: "text",
		required: !1,
		psm: "single_line",
		minConfidence: 50,
		stripPunctuation: !0
	},
	{
		key: "code",
		region: y(448, 143, 572, 173),
		kind: "numeric",
		required: !0,
		psm: "single_line",
		whitelist: _,
		expectedLength: 8,
		minConfidence: 70,
		labelPattern: v
	},
	{
		key: "dni",
		region: y(430, 175, 552, 199),
		kind: "numeric",
		required: !0,
		psm: "single_line",
		whitelist: _,
		expectedLength: 8,
		minConfidence: 70,
		labelPattern: v,
		marginY: .001
	},
	{
		key: "lastname1",
		region: y(354, 238, 478, 267),
		kind: "alpha",
		required: !0,
		psm: "single_line",
		minConfidence: 60,
		marginY: .002,
		labelPattern: v
	},
	{
		key: "lastname2",
		region: y(354, 269, 462, 300),
		kind: "alpha",
		required: !1,
		psm: "single_line",
		minConfidence: 60,
		marginY: .002
	},
	{
		key: "name",
		region: y(354, 338, 654, 366),
		kind: "alpha",
		required: !0,
		psm: "single_line",
		minConfidence: 60,
		marginY: .002,
		labelPattern: v
	},
	{
		key: "faculty",
		region: y(354, 408, 602, 436),
		kind: "text",
		required: !0,
		psm: "single_line",
		minConfidence: 60,
		marginY: .002,
		labelPattern: v
	},
	{
		key: "degree",
		region: y(354, 461, 552, 488),
		kind: "text",
		required: !0,
		psm: "single_line",
		minConfidence: 60,
		marginY: .002,
		labelPattern: v
	},
	{
		key: "admission_period",
		region: y(46, 500, 136, 530),
		kind: "period",
		required: !0,
		psm: "single_line",
		whitelist: `${_}-`,
		minConfidence: 60
	},
	{
		key: "day_expiration",
		region: y(880, 195, 945, 234),
		kind: "numeric",
		required: !0,
		psm: "single_line",
		whitelist: _,
		expectedLength: 2,
		range: [1, 31],
		minConfidence: 70
	},
	{
		key: "month_expiration",
		region: y(880, 240, 945, 282),
		kind: "numeric",
		required: !0,
		psm: "single_line",
		whitelist: _,
		expectedLength: 2,
		range: [1, 12],
		minConfidence: 70
	},
	{
		key: "year_expiration",
		region: y(880, 286, 945, 328),
		kind: "numeric",
		required: !0,
		psm: "single_line",
		whitelist: _,
		expectedLength: 2,
		range: [0, 99],
		minConfidence: 70
	},
	{
		key: "low_title",
		region: y(38, 556, 450, 598),
		kind: "text",
		required: !1,
		psm: "single_line",
		invert: !0,
		minConfidence: 50,
		stripPunctuation: !0,
		fallbacks: [
			{ invert: !1 },
			{
				invert: !1,
				targetHeightPx: 96
			},
			{
				invert: !1,
				stretch: !0,
				targetHeightPx: 96
			}
		]
	}
];
//#endregion
//#region src/image/region-cropper.ts
function x(e) {
	return [
		e.x,
		e.y,
		e.width,
		e.height
	].every(Number.isFinite) && e.x >= 0 && e.y >= 0 && e.width > 0 && e.height > 0 && e.x + e.width <= 1 + 1e-9 && e.y + e.height <= 1 + 1e-9;
}
function S(e, t) {
	return .299 * e[t] + .587 * e[t + 1] + .114 * e[t + 2];
}
function ee(e) {
	let t = /* @__PURE__ */ new Uint32Array(256), n = e.length / 4;
	for (let n = 0; n < e.length; n += 4) t[Math.round(S(e, n))]++;
	let r = 0, i = 0, a = 255;
	for (let e = 0; e < 256; e++) if (r += t[e], r >= n * .02) {
		i = e;
		break;
	}
	r = 0;
	for (let e = 255; e >= 0; e--) if (r += t[e], r >= n * .02) {
		a = e;
		break;
	}
	if (a - i < 16) return;
	let o = 255 / (a - i);
	for (let t = 0; t < e.length; t += 4) for (let n = 0; n < 3; n++) e[t + n] = Math.min(255, Math.max(0, (e[t + n] - i) * o));
}
function C(e) {
	let t = /* @__PURE__ */ new Uint32Array(256), n = e.length / 4;
	for (let n = 0; n < e.length; n += 4) t[Math.round(S(e, n))]++;
	let r = 0;
	for (let e = 0; e < 256; e++) r += e * t[e];
	let i = 0, a = 0, o = 0, s = -1;
	for (let e = 0; e < 256; e++) {
		if (i += t[e], i === 0) continue;
		let c = n - i;
		if (c === 0) break;
		a += e * t[e];
		let l = a / i, u = (r - a) / c, d = i * c * (l - u) ** 2;
		d > s && (s = d, o = e);
	}
	return o;
}
function w(e) {
	let t = C(e);
	for (let n = 0; n < e.length; n += 4) {
		let r = S(e, n) <= t ? 0 : 255;
		e[n] = e[n + 1] = e[n + 2] = r;
	}
}
function T(e, t, n, r) {
	if (r < 1) return;
	let i = new Uint8Array(t * n);
	for (let r = 0; r < t * n; r++) i[r] = e[r * 4];
	let a = new Uint8Array(t * n);
	for (let e = 0; e < n; e++) for (let n = 0; n < t; n++) {
		let o = 255;
		for (let a = Math.max(0, n - r); a <= Math.min(t - 1, n + r); a++) o = Math.min(o, i[e * t + a]);
		a[e * t + n] = o;
	}
	for (let e = 0; e < t; e++) for (let o = 0; o < n; o++) {
		let s = 255;
		for (let i = Math.max(0, o - r); i <= Math.min(n - 1, o + r); i++) s = Math.min(s, a[i * t + e]);
		i[o * t + e] = s;
	}
	for (let r = 0; r < t * n; r++) e[r * 4] = e[r * 4 + 1] = e[r * 4 + 2] = i[r];
}
function E(e, t, n = {}) {
	if (!x(t)) throw RangeError(`Región inválida: ${JSON.stringify(t)}`);
	let { marginX: r = .004, marginY: i = .004, targetHeightPx: a = 64, maxScale: o = 4, padPx: s = 10, invert: c = !1, stretch: l = !1, binarize: u = !1, thicken: d = 0 } = n, f = Math.max(0, t.x - r), p = Math.max(0, t.y - i), m = Math.min(1, t.x + t.width + r), h = Math.min(1, t.y + t.height + i), g = Math.floor(f * e.width), _ = Math.floor(p * e.height), v = Math.ceil(m * e.width) - g, y = Math.ceil(h * e.height) - _;
	if (v < 1 || y < 1) throw RangeError("El recorte resultante tiene dimensiones vacías.");
	let b = Math.min(o, Math.max(1, a / y)), S = Math.max(1, Math.round(v * b)), C = Math.max(1, Math.round(y * b)), E = document.createElement("canvas");
	E.width = S + s * 2, E.height = C + s * 2;
	let D = c || l || u || d > 0, O = E.getContext("2d", { willReadFrequently: D });
	if (!O) throw Error("No se pudo obtener el contexto 2D del canvas.");
	if (O.fillStyle = "#ffffff", O.fillRect(0, 0, E.width, E.height), O.imageSmoothingEnabled = !0, O.imageSmoothingQuality = "high", O.drawImage(e, g, _, v, y, s, s, S, C), D) {
		let e = O.getImageData(s, s, S, C), t = e.data;
		if (l && ee(t), u && w(t), d > 0 && T(t, S, C, d), c) for (let e = 0; e < t.length; e += 4) t[e] = 255 - t[e], t[e + 1] = 255 - t[e + 1], t[e + 2] = 255 - t[e + 2];
		O.putImageData(e, s, s);
	}
	return E;
}
//#endregion
//#region src/extraction/field-rules.ts
function D(e) {
	return e.normalize("NFC").replace(/\s+/g, " ").trim();
}
function O(e, t) {
	return t ? D(e.replace(t, "")) : e;
}
var k = {
	O: "0",
	o: "0",
	Q: "0",
	D: "0",
	I: "1",
	l: "1",
	"|": "1",
	i: "1",
	Z: "2",
	S: "5",
	s: "5",
	B: "8"
};
function A(e) {
	let t = "";
	for (let n of e) /\d/.test(n) ? t += n : n in k && (t += k[n]);
	return t;
}
function j(e) {
	return e.normalize("NFC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function te(e) {
	let t = e.replace(/[–—_.:\s]/g, (e) => e === " " ? "" : "-").replace(/[Oo]/g, "0").replace(/[Il|]/g, "1"), n = t.match(/(\d{4})-?(\d)/);
	return n ? `${n[1]}-${n[2]}` : D(t);
}
function ne(e, t) {
	let n = O(D(t), e.labelPattern);
	switch (e.kind) {
		case "numeric": return A(n);
		case "code": return j(n);
		case "period": return te(n);
		case "alpha":
		case "text": {
			let t = e.stripPunctuation ? /[^\p{L}\p{N} ]/gu : /[^\p{L}\p{N}.,'\- ]/gu;
			return D(n.replace(t, " "));
		}
	}
}
var re = /^[\p{L}][\p{L}'\- ]*$/u, M = (e) => (e.match(/\p{L}/gu) ?? []).length;
function N(e, t) {
	switch (e.kind) {
		case "numeric":
			if (!/^\d+$/.test(t)) return {
				valid: !1,
				reason: "No es numérico."
			};
			if (e.expectedLength && t.length !== e.expectedLength) return {
				valid: !1,
				reason: `Longitud ${t.length}, se esperaban ${e.expectedLength}.`
			};
			if (e.range) {
				let n = Number(t);
				if (n < e.range[0] || n > e.range[1]) return {
					valid: !1,
					reason: `Fuera de rango ${e.range[0]}–${e.range[1]}.`
				};
			}
			return { valid: !0 };
		case "alpha": return t.length < 2 || !re.test(t) ? {
			valid: !1,
			reason: "Contiene caracteres no alfabéticos o es demasiado corto."
		} : { valid: !0 };
		case "text": return M(t) >= 3 ? { valid: !0 } : {
			valid: !1,
			reason: "Texto demasiado corto o sin letras suficientes."
		};
		case "code": return /^[A-Z0-9]{4,16}$/.test(t) ? { valid: !0 } : {
			valid: !1,
			reason: "No tiene forma de código alfanumérico (4–16)."
		};
		case "period": return /^\d{4}-\d$/.test(t) ? { valid: !0 } : {
			valid: !1,
			reason: "No cumple el formato AAAA-N."
		};
	}
}
//#endregion
//#region src/extraction/region-extractor.ts
var P = {
	numeric: [
		{ psm: "single_word" },
		{
			inset: .08,
			targetHeightPx: 96
		},
		{
			stretch: !0,
			targetHeightPx: 96
		},
		{
			stretch: !0,
			psm: "single_word",
			marginX: .01,
			marginY: .008
		}
	],
	period: [{ psm: "single_word" }, {
		stretch: !0,
		targetHeightPx: 96
	}],
	alpha: [{ targetHeightPx: 96 }],
	text: [{ targetHeightPx: 96 }],
	code: [{ psm: "single_word" }, {
		stretch: !0,
		targetHeightPx: 96
	}]
}, F = {
	ok: 3,
	low_confidence: 2,
	invalid: 1,
	not_detected: 0
};
function I(e, t) {
	let n = Math.min(Math.max(t, 0), .4), r = e.width * n, i = e.height * n;
	return {
		x: e.x + r,
		y: e.y + i,
		width: e.width - 2 * r,
		height: e.height - 2 * i
	};
}
function L(e, t) {
	let n = F[e.state], r = F[t.state];
	return n === r ? (e.confidence ?? -1) > (t.confidence ?? -1) : n > r;
}
function R(e, t, n) {
	let r = ne(e, t);
	if (r === "") return {
		key: e.key,
		rawText: t,
		value: "",
		confidence: n,
		state: "not_detected"
	};
	let i = N(e, r);
	return i.valid ? n < e.minConfidence ? {
		key: e.key,
		rawText: t,
		value: r,
		confidence: n,
		state: "low_confidence",
		reason: `Confianza ${n.toFixed(0)} < ${e.minConfidence}.`
	} : {
		key: e.key,
		rawText: t,
		value: r,
		confidence: n,
		state: "ok"
	} : {
		key: e.key,
		rawText: t,
		value: "",
		confidence: n,
		state: "invalid",
		reason: i.reason
	};
}
function z(e, t) {
	let n = t.filter((e) => e.value !== "" && (e.state === "ok" || e.state === "low_confidence"));
	if (n.length < 2) return null;
	let r = /* @__PURE__ */ new Map();
	for (let e of n) {
		let t = r.get(e.value.length) ?? [];
		t.push(e), r.set(e.value.length, t);
	}
	let i = (e) => e.reduce((e, t) => e + (t.confidence ?? 0), 0), a = [];
	for (let e of r.values()) (e.length > a.length || e.length === a.length && i(e) > i(a)) && (a = e);
	if (a.length < 2) return null;
	let o = a[0].value.length, s = "", c = 0;
	for (let e = 0; e < o; e++) {
		let t = /* @__PURE__ */ new Map(), n = 0;
		for (let r of a) {
			let i = Math.max(r.confidence ?? 0, 1);
			t.set(r.value[e], (t.get(r.value[e]) ?? 0) + i), n += i;
		}
		let r = "", i = -1;
		for (let [e, n] of t) n > i && (i = n, r = e);
		s += r, c += i / n;
	}
	let l = c / o, u = a.reduce((e, t) => e + (t.confidence ?? 0), 0) / a.length * l, d = `Consenso de ${a.length}/${t.length} lecturas, acuerdo ${(l * 100).toFixed(0)} %.`, f = N(e, s);
	if (!f.valid) return {
		key: e.key,
		rawText: a.map((e) => e.rawText.trim()).join(" | "),
		value: "",
		confidence: u,
		state: "invalid",
		reason: `${f.reason} ${d}`
	};
	let p = u < e.minConfidence ? "low_confidence" : "ok";
	return {
		key: e.key,
		rawText: a.map((e) => e.rawText.trim()).join(" | "),
		value: s,
		confidence: u,
		state: p,
		reason: d
	};
}
async function B(e, t, n, r) {
	let i = r.inset ? I(n.region, r.inset) : n.region, a = E(u(e), i, {
		marginX: r.marginX ?? n.marginX,
		marginY: r.marginY ?? n.marginY,
		invert: r.invert ?? n.invert,
		stretch: r.stretch,
		binarize: r.binarize,
		thicken: r.thicken,
		targetHeightPx: r.targetHeightPx
	}), o = await t.recognize(d(a), {
		pageSegMode: r.psm ?? n.psm,
		whitelist: n.whitelist,
		noDictionary: n.noDictionary
	});
	return {
		reading: R(n, o.text, o.confidence),
		crop: a
	};
}
async function V(e, t, n) {
	let r = [{}, ...n.fallbacks ?? P[n.kind]], i = null, a = null, o = [], s, c = 0;
	for (let l of r) {
		c++;
		try {
			let { reading: r, crop: s } = await B(e, t, n, l);
			if (o.push(r), (!i || L(r, i)) && (i = r, a = s), !n.consensus && r.state === "ok") break;
		} catch (e) {
			s = e instanceof Error ? e.message : "Error desconocido al leer la región.";
		}
	}
	if (!i) return {
		key: n.key,
		rawText: "",
		value: "",
		confidence: null,
		state: "not_detected",
		reason: s,
		attempts: c
	};
	let l = {
		...(n.consensus ? z(n, o) : null) ?? i,
		attempts: c
	};
	return n.alwaysReview && l.state === "ok" ? (l.state = "low_confidence", l.reason = `${n.alwaysReview} ${l.reason ?? ""}`.trim()) : l.state !== "ok" && c > 1 && (l.reason = `${l.reason ?? ""} (${c} intentos)`.trim()), a && (l.cropDataUrl = a.toDataURL("image/png")), l;
}
async function H(e, t, n = b) {
	let r = [];
	for (let i of n) r.push(await V(e, t, i));
	return r;
}
var U = 600, W = 350, G = 1.58, K = .25;
function q(e, t) {
	let n = t.filter((e) => e.required), r = new Map(e.map((e) => [e.key, e])), i = 0, a = !0;
	for (let e of n) {
		let t = r.get(e.key)?.state ?? "not_detected";
		(t === "ok" || t === "low_confidence") && i++, t !== "ok" && (a = !1);
	}
	return n.length === 0 || i / n.length < .5 ? "unrecognized" : a ? "recognized" : "needs_review";
}
var J = class {
	engine;
	specs;
	constructor(e = new p(), t = b) {
		this.engine = e, this.specs = t;
	}
	async read(e) {
		let t = ["El OCR solo extrae texto; no verifica la autenticidad del carné."], n = i(await c(e)), r = u(n);
		if (r.width < U || r.height < W) return {
			status: "unrecognized",
			data: this.emptyData(),
			warnings: [...t, `Imagen demasiado pequeña (${r.width}×${r.height}).`],
			fields: []
		};
		let a = r.width / r.height;
		Math.abs(a - G) > K && t.push("La proporción de la imagen no coincide con la de un carné encuadrado; las regiones fijas pueden no alinear. Recorta la foto al borde del carné.");
		let o = await H(n, this.engine, this.specs), s = this.emptyData();
		for (let e of o) s[e.key] = e.value;
		let l = new Map(this.specs.map((e) => [e.key, e]));
		for (let e of o) {
			let n = l.get(e.key)?.required ?? !1 ? "" : " (opcional)";
			e.state === "not_detected" ? t.push(`${e.key}: no detectado${n}.`) : e.state === "invalid" ? t.push(`${e.key}: formato inválido${n}. ${e.reason ?? ""}`.trim()) : e.state === "low_confidence" && t.push(`${e.key}: baja confianza${n}. ${e.reason ?? ""}`.trim());
		}
		return {
			status: q(o, this.specs),
			data: s,
			warnings: t,
			fields: o
		};
	}
	async dispose() {
		await this.engine.dispose();
	}
	emptyData() {
		return Object.fromEntries(h.map((e) => [e, ""]));
	}
}, Y = {
	language: "spa",
	includeFieldDetails: !1,
	includeRawText: !1,
	includeCropImages: !1
}, ie = /^[a-z]{3}(\+[a-z]{3})*$/;
function X() {
	return Object.fromEntries(h.map((e) => [e, ""]));
}
function Z(e, t = {}) {
	let n = {
		status: e,
		flags: {
			recognized: e === "recognized",
			needsReview: e === "needs_review",
			unrecognized: e === "unrecognized",
			hasError: e === "error",
			authenticityVerified: !1
		},
		data: t.data ?? X(),
		fieldsToReview: t.fieldsToReview ?? [],
		warnings: t.warnings ?? [],
		error: t.error ?? null
	};
	return t.details && (n.details = t.details), n;
}
function Q(e, t) {
	return Z("error", { error: {
		code: e,
		message: t
	} });
}
function ae(e, t) {
	let n = {
		key: e.key,
		value: e.value,
		state: e.state,
		confidence: e.confidence
	};
	return e.reason && (n.reason = e.reason), t.includeRawText && (n.rawText = e.rawText), t.includeCropImages && e.cropDataUrl && (n.cropImage = e.cropDataUrl), n;
}
function oe(e, t) {
	let n = X();
	for (let t of h) n[t] = e.data[t] ?? "";
	let r = e.fields ?? [], i = t.includeFieldDetails || t.includeRawText || t.includeCropImages;
	return Z(e.status, {
		data: n,
		fieldsToReview: r.filter((e) => e.state !== "ok").map((e) => e.key),
		warnings: e.warnings,
		details: i ? r.map((e) => ae(e, t)) : void 0
	});
}
var $ = class {
	file = null;
	params = { ...Y };
	reader = null;
	readerLanguage = "";
	queue = Promise.resolve();
	setFile(e) {
		return this.file = e, this;
	}
	setParams(e) {
		this.params = { ...Y };
		for (let t of Object.keys(Y)) {
			let n = e[t];
			n !== void 0 && (this.params[t] = n);
		}
		return this;
	}
	send() {
		let e = this.file, t = { ...this.params }, n = this.queue.then(() => this.execute(e, t));
		return this.queue = n.then(() => void 0, () => void 0), n;
	}
	async dispose() {
		await this.queue;
		let e = this.reader;
		this.reader = null, this.readerLanguage = "", e && await e.dispose();
	}
	async execute(e, t) {
		if (!(e instanceof Blob)) return Q("NO_FILE", "No se ha indicado ningún archivo. Llama a setFile() antes de send().");
		if (!ie.test(t.language)) return Q("INVALID_PARAMS", `Idioma inválido: "${t.language}". Usa códigos de 3 letras, p. ej. "spa" o "spa+eng".`);
		try {
			return oe(await (await this.getReader(t.language)).read(e), t);
		} catch (e) {
			return Q("PROCESSING_ERROR", e instanceof Error ? e.message : "Error desconocido al procesar la imagen.");
		}
	}
	async getReader(e) {
		return this.reader && this.readerLanguage === e || (this.reader && await this.reader.dispose(), this.reader = new J(new p(e)), this.readerLanguage = e), this.reader;
	}
};
async function se(e, t = {}) {
	let n = new $();
	try {
		return await n.setFile(e).setParams(t).send();
	} finally {
		await n.dispose();
	}
}
//#endregion
export { $ as CardValidatorOCR, se as validateCard };

//# sourceMappingURL=index.js.map