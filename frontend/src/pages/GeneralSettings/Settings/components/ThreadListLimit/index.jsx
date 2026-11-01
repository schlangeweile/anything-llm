import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Appearance from "@/models/appearance";
import Toggle from "@/components/lib/Toggle";

const DEFAULT_LIMIT = 8;

/**
 * R1 preference: fold older threads behind a "show older threads" toggle.
 * The stored value is the visible thread count; 0 means "show all" (default).
 */
export default function ThreadListLimit() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

  useEffect(() => {
    const stored = Number(Appearance.get("threadListLimit")) || 0;
    setEnabled(stored > 0);
    setLimit(stored > 0 ? stored : DEFAULT_LIMIT);
  }, []);

  const apply = (nextEnabled, nextLimit) => {
    setEnabled(nextEnabled);
    setLimit(nextLimit);
    Appearance.set("threadListLimit", nextEnabled ? nextLimit : 0);
  };

  const onChangeLimit = (event) => {
    const parsed = Number(event.target.value);
    if (!Number.isFinite(parsed)) return;
    const nextLimit = Math.min(100, Math.max(1, Math.floor(parsed)));
    apply(true, nextLimit);
  };

  return (
    <div className="my-4">
      <Toggle
        size="md"
        variant="horizontal"
        enabled={enabled}
        onChange={(checked) => apply(checked, limit)}
        label={t("customization.items.thread-list.title")}
        description={t("customization.items.thread-list.description")}
      />
      {enabled && (
        <div className="flex items-center gap-x-2 mt-3 pl-1">
          <label
            htmlFor="thread-list-limit"
            className="text-sm text-white light:text-slate-900"
          >
            {t("customization.items.thread-list.limit")}
          </label>
          <input
            id="thread-list-limit"
            type="number"
            min={1}
            max={100}
            value={limit}
            onChange={onChangeLimit}
            className="w-20 border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block py-1.5 px-3"
          />
        </div>
      )}
    </div>
  );
}
