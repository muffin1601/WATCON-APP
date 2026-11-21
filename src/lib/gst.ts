/** Indian GST reference data and validators (client-safe). */

export const GST_STATES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
};

export const GST_RATES = ["0", "0.25", "3", "5", "12", "18", "28"] as const;

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const HSN_RE = /^\d{4}(\d{2}){0,2}$/;

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** GSTIN check digit (mod-36 Luhn variant used by GSTN). */
export function gstinChecksumValid(gstin: string): boolean {
  if (!GSTIN_RE.test(gstin)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(gstin[i]!);
    const p = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  const check = CHARS[(36 - (sum % 36)) % 36];
  return check === gstin[14];
}

export const stateName = (code: string | null | undefined) => (code ? (GST_STATES[code] ?? code) : "—");

/** Common TDS sections (reference list; rates are always entered/confirmed by the user). */
export const TDS_SECTIONS = ["194C", "194J", "194I", "194H", "194Q", "194A", "194O"] as const;
