import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../hooks/useAdminAuth";

export default function AdminLogin() {
    const navigate = useNavigate();
    const { login } = useAdminAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        const result = await login(email, password);
        if (!result.success) {
            setError(result.message || "Login failed.");
        }
        setSubmitting(false);
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#EDE6DA] px-6 text-[#432817]">
            <div className="w-full max-w-sm">
                <div className="mb-8 text-center">
                    <button
                        type="button"
                        onClick={() => navigate("/")}
                        className="font-serif text-2xl tracking-[0.16em]"
                    >
                        AURELIA
                    </button>
                    <p className="mt-2 text-[10px] font-medium tracking-[0.3em] text-[#977150] uppercase">
                        Admin Portal
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Email
                        </label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-sm outline-none focus:border-[#432817]"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Password
                        </label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-sm outline-none focus:border-[#432817]"
                        />
                    </div>

                    {error && <p className="text-xs text-[#9B4635]">{error}</p>}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-[#432817] py-3 text-[10px] font-medium tracking-[0.2em] text-[#EDE6DA] uppercase hover:bg-[#5a3720] disabled:opacity-50"
                    >
                        {submitting ? "Signing in…" : "Sign in"}
                    </button>
                </form>
            </div>
        </main>
    );
}