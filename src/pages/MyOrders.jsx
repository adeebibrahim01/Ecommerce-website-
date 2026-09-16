import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Tag, ChevronLeft, Package } from "lucide-react";

const API_BASE_URL = "https://ecommerce-website.adeebibrahim01.workers.dev";

function StatusBadge({ status }) {
  const styles = {
    paid: "bg-[#EDE6DA] text-[#432817]",
    pending: "bg-[#F7F3EC] text-[#977150]",
    cancelled: "bg-[#F7E9E4] text-[#B04A2E]",
  };
  return (
    <span
      className={`rounded-full px-3 py-1 text-[9px] font-semibold tracking-[0.12em] uppercase ${
        styles[status] || "bg-[#F7F3EC] text-[#977150]"
      }`}
    >
      {status}
    </span>
  );
}

function OrderList({ onSelect }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("auth_token");
      try {
        const res = await fetch(`${API_BASE_URL}/orders`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setOrders(data.orders || []);
        } else {
          setError(data.message || "Could not load orders.");
        }
      } catch {
        setError("Could not load orders.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#EDE6DA]" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-[#B04A2E]">{error}</p>;
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#D1B79E] bg-[#F7F3EC] py-16 text-center">
        <Package size={28} className="text-[#977150]" />
        <p className="text-sm text-[#432817]">Aapka koi order nahi mila.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => (
        <button
          key={order.id}
          type="button"
          onClick={() => onSelect(order.id)}
          className="flex items-center justify-between rounded-2xl border border-[#D1B79E] bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex flex-col gap-1">
            <span className="font-serif text-sm text-[#432817]">{order.order_number}</span>
            <span className="text-[10px] tracking-[0.08em] text-[#977150] uppercase">
              {new Date(order.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <StatusBadge status={order.status} />
            <span className="font-serif text-sm text-[#432817]">
              ${Number(order.total).toFixed(2)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function OrderDetail({ orderId, onBack }) {
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("auth_token");
      try {
        const res = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setOrder(data.order);
          setItems(data.items || []);
        } else {
          setError(data.message || "Order not found.");
        }
      } catch {
        setError("Order not found.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orderId]);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-[#EDE6DA]" />;
  }

  if (error || !order) {
    return <p className="text-sm text-[#B04A2E]">{error || "Order not found."}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.15em] text-[#977150] uppercase hover:text-[#432817]"
      >
        <ChevronLeft size={14} /> Back to orders
      </button>

      <div className="flex items-center justify-between rounded-2xl border border-[#D1B79E] bg-[#F7F3EC] p-5">
        <div>
          <p className="font-serif text-base text-[#432817]">{order.order_number}</p>
          <p className="text-[10px] tracking-[0.08em] text-[#977150] uppercase">
            {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 rounded-2xl border border-[#D1B79E] bg-white p-4"
          >
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                className="h-16 w-16 shrink-0 rounded-xl border border-[#D1B79E]/60 object-cover"
              />
            ) : (
              <div className="h-16 w-16 shrink-0 rounded-xl bg-[#EDE6DA]" />
            )}

            <div className="flex-1">
              <p className="font-serif text-sm text-[#432817]">{item.name}</p>
              <p className="text-[10px] tracking-[0.08em] text-[#977150] uppercase">
                Qty {item.quantity}
              </p>
              {item.deal_label && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#EDE6DA] px-2 py-0.5 text-[9px] font-semibold tracking-[0.08em] text-[#432817] uppercase">
                  <Tag size={10} /> {item.deal_label}
                </span>
              )}
            </div>

            <div className="text-right">
              {item.original_price && Number(item.original_price) > Number(item.price) && (
                <p className="text-[10px] text-[#977150] line-through">
                  ${Number(item.original_price).toFixed(2)}
                </p>
              )}
              <p className="font-serif text-sm text-[#432817]">
                ${Number(item.line_total).toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border border-[#D1B79E] bg-[#F7F3EC] p-5 text-sm text-[#432817]">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>${Number(order.subtotal).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Shipping</span>
          <span>${Number(order.shipping).toFixed(2)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-[#D1B79E] pt-2 font-serif text-base">
          <span>Total</span>
          <span>${Number(order.total).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

export default function MyOrders() {
  const navigate = useNavigate();
  const { orderId } = useParams();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 font-serif text-2xl text-[#432817]">My Orders</h1>
      {orderId ? (
        <OrderDetail orderId={orderId} onBack={() => navigate("/my-orders")} />
      ) : (
        <OrderList onSelect={(id) => navigate(`/my-orders/${id}`)} />
      )}
    </div>
  );
}