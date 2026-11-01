import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Toggle from "@/components/lib/Toggle";
import { getShowChatMetrics, setShowChatMetrics } from "@/utils/chatMetrics";

/**
 * Show the per-message metrics line (model, duration, tok/s, token usage and
 * timestamp) without hovering over the answer. Off by default; the line can
 * still be pinned by clicking it in a chat.
 */
export default function ChatMetrics() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(getShowChatMetrics());
  }, []);

  const onChange = (checked) => {
    setEnabled(checked);
    setShowChatMetrics(checked);
  };

  return (
    <div className="my-4">
      <Toggle
        size="md"
        variant="horizontal"
        enabled={enabled}
        onChange={onChange}
        label={t("customization.items.chat-metrics.title")}
        description={t("customization.items.chat-metrics.description")}
      />
    </div>
  );
}
