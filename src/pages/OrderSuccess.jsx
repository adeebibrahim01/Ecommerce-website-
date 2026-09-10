import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";

const API_BASE_URL = "https://cart-worker-service.adeebibrahim01.workers.dev";

export default function OrderSuccess() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const sessionId = searchParams.get("session_id");

    const [status, setStatus] = useState("checking"); // checking | found | not_found
    const [order, setOrder] = useState(null);

    useEffect(() => {
        if (!sessionId) {
            setStatus("not_found");
            return;
        }

        let attempts = 0;
        let cancelled = false;

        const poll = async () => {
            attempts += 1;
            try {
                const res = await fetch(`${API_BASE_URL}/order/by-session/${sessionId}`);
                const data = await res.json();
                if (cancelled) return;

                if (data.success) {
                    setOrder(data.order);
                    setStatus("found");
                    window.dispatchEvent(new Event("cart-change")); // navbar cart badge refresh
                } else if (attempts < 8) {
                    setTimeout(poll, 1500); // webhook ko thoda time dein, retry karein
                } else {
                    setStatus("not_found");
                }
            } catch {
                if (!cancelled && attempts < 8) setTimeout(poll, 1500);
                else if (!cancelled) setStatus("not_found");
            }
        };

        poll();
        return () => { cancelled = true; };
    }, [sessionId]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#F7F3EC] p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl border border-[#D1B79E]">
                {status === "checking" && (
                    <>
                        <Loader2 className="mx-auto animate-spin text-[#432817]" size={32} />
                        <p className="mt-4 text-xs tracking-widest text-[#432817] uppercase">
                            Confirming your payment...
                        </p>
                    </>
                )}

                {status === "found" && (
                    <>
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EDE6DA] text-[#432817]">
                            <CheckCircle2 size={28} />
                        </div>
                        <h1 className="mt-4 text-sm font-semibold tracking-wider text-[#432817] uppercase">
                            Order Placed!
                        </h1>
                        <p className="mt-2 text-xs text-[#8A8177]">
                            Order #{order?.order_number} — ${Number(order?.total).toLocaleString()}
                        </p>
                        <button
                            onClick={() => navigate("/")}
                            className="mt-6 w-full rounded-none bg-[#432817] py-2.5 text-[10px] font-medium tracking-[0.2em] text-white uppercase hover:bg-[#977150]"
                        >
                            Back to Home
                        </button>
                    </>
                )}

                {status === "not_found" && (
                    <>
                        <p className="text-xs text-[#8A8177]">
                            Payment confirm ho rahi hai. Thodi der mein aapko order history mein order nazar aa jayega.
                        </p>
                        <button
                            onClick={() => navigate("/")}
                            className="mt-6 w-full rounded-none bg-[#432817] py-2.5 text-[10px] font-medium tracking-[0.2em] text-white uppercase hover:bg-[#977150]"
                        >
                            Back to Home
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}