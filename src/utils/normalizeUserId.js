// utils/normalizeUserId.js
export function normalizeUserId(user) {
    const raw = user?.id ?? user?._id ?? user?.sub ?? user?.email;
    if (raw == null) return null;

    // Agar yeh number jaisa hai (33, "33", "33.0", 33.0) to integer bana do
    const num = Number(raw);
    if (Number.isFinite(num) && !Number.isNaN(num)) {
        return String(Math.trunc(num)); // "33.0" -> 33 -> "33"
    }

    return String(raw); // email jaisa non-numeric id waisa hi rahega
}