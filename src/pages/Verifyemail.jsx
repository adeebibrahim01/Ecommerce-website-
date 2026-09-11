import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function VerifyEmail() {
    const navigate = useNavigate();
    const { user, verifyEmail, resendVerificationCode } = useAuth();

    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [resendMessage, setResendMessage] = useState("");
    const [resending, setResending] = useState(false);
    const inputRef = useRef(null);

    const handleVerify = async (e) => {
        e.preventDefault();
        setErrorMessage("");

        if (code.length !== 6) {
            setErrorMessage("Please enter the 6-digit code.");
            return;
        }

        setLoading(true);
        const result = await verifyEmail(code);
        setLoading(false);

        if (!result.success) {
            setErrorMessage(result.message || "Invalid code. Please try again.");
            return;
        }

        navigate("/", { replace: true });
    };

    const handleResend = async () => {
        setResending(true);
        setResendMessage("");
        setErrorMessage("");

        const result = await resendVerificationCode();
        setResending(false);

        setResendMessage(
            result.success
                ? "A new code has been sent to your email."
                : result.message || "Failed to resend code."
        );
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#eee9df] px-6 py-12">
            <div className="w-full max-w-[420px] text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#CFC4B5] bg-white/40">
                    <MailCheck size={26} strokeWidth={1.4} className="text-[#432817]" />
                </div>

                <h1 className="font-serif text-[36px] font-medium leading-none tracking-[-0.025em] text-[#432817] sm:text-[42px]">
                    Verify your email
                </h1>

                <p className="mt-4 text-[11px] leading-6 tracking-[0.01em] text-[#81786f]">
                    We've sent a 6-digit code to{" "}
                    <span className="font-semibold text-[#432817]">{user?.email || "your email"}</span>.
                    Enter it below to activate your account.
                </p>

                <form onSubmit={handleVerify} className="mt-8 flex flex-col items-center gap-5">
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="000000"
                        className="h-[56px] w-full max-w-[220px] border border-[#cfc6ba] bg-[#f3efe7] text-center text-[24px] tracking-[0.5em] text-[#432817] outline-none transition-all duration-300 focus:border-[#432817] focus:bg-[#f7f3ec]"
                    />

                    {errorMessage && (
                        <div className="w-full border border-red-200 bg-red-50/60 px-4 py-3">
                            <p className="text-[10px] leading-5 tracking-wide text-red-600">{errorMessage}</p>
                        </div>
                    )}

                    {resendMessage && !errorMessage && (
                        <div className="w-full border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                            <p className="text-[10px] leading-5 tracking-wide text-emerald-700">{resendMessage}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="h-[44px] w-full bg-[#432817] text-[9px] font-semibold tracking-[0.25em] text-[#eee9df] uppercase transition-all duration-300 hover:bg-[#5a3720] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? "Verifying..." : "Verify Account"}
                    </button>
                </form>

                <div className="mt-6">
                    <p className="text-[10px] text-[#8b8177]">Didn't get the code?</p>
                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={resending}
                        className="mt-2 inline-block text-[9px] font-semibold tracking-[0.2em] text-[#432817] uppercase underline decoration-[#432817]/40 underline-offset-4 transition-colors duration-300 hover:text-[#6a4329] disabled:opacity-50"
                    >
                        {resending ? "Sending..." : "Resend code"}
                    </button>
                </div>
            </div>
        </div>
    );
}