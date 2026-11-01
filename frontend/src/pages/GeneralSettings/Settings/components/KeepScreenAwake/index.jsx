import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Appearance from "@/models/appearance";
import Toggle from "@/components/lib/Toggle";

/**
 * R9 preference: request a Screen Wake Lock while a response is streaming.
 * Off by default; the API only works in a secure context (HTTPS), which the
 * add-on gets through the reverse proxy setup.
 */
export default function KeepScreenAwake() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(!!Appearance.get("keepScreenAwake"));
  }, []);

  const onChange = (checked) => {
    setEnabled(checked);
    Appearance.set("keepScreenAwake", checked);
  };

  return (
    <div className="my-4">
      <Toggle
        size="md"
        variant="horizontal"
        enabled={enabled}
        onChange={onChange}
        label={t("customization.items.wake-lock.title")}
        description={t("customization.items.wake-lock.description")}
      />
    </div>
  );
}
