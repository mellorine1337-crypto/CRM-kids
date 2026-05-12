// Кратко: изолирует Stripe Elements и подтверждение онлайн-оплаты.
import { useMemo, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useI18n } from "../hooks/useI18n.js";

// Служебная функция CheckoutForm: инкапсулирует отдельный шаг логики этого модуля.
function CheckoutForm({ paymentId, onConfirm, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const { t } = useI18n();

  // Функция handleSubmit: обрабатывает пользовательское действие или событие.
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setSubmitting(true);

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: window.location.href,
      },
    });

    setSubmitting(false);

    if (result.error) {
      onError(result.error.message || t("stripe.confirmFailed"));
      return;
    }

    await onConfirm(paymentId);
  };

  return (
    <form className="stack-md" onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit" className="button button--primary" disabled={submitting}>
        {submitting ? t("stripe.confirming") : t("stripe.confirmPayment")}
      </button>
    </form>
  );
}

// Служебная функция StripePaymentForm: инкапсулирует отдельный шаг логики этого модуля.
export function StripePaymentForm({
  paymentId,
  clientSecret,
  publishableKey,
  onConfirm,
  onError,
}) {
  const { t } = useI18n();
  const stripePromise = useMemo(() => {
    if (!publishableKey) {
      return null;
    }

    return loadStripe(publishableKey);
  }, [publishableKey]);

  if (!publishableKey || !stripePromise) {
    return (
      <div className="empty-state">
        <strong>{t("stripe.missingKeyTitle")}</strong>
        <p>{t("stripe.missingKeyDescription")}</p>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          variables: {
            colorPrimary: "#4F8EF7",
            colorBackground: "#ffffff",
            colorText: "#1F2937",
          },
        },
      }}
    >
      <CheckoutForm
        paymentId={paymentId}
        onConfirm={onConfirm}
        onError={onError}
      />
    </Elements>
  );
}
