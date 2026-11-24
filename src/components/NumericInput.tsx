import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | "" | null | undefined;
  /** Called with the parsed number while typing; an empty field reports `emptyValue`. */
  onValueChange: (value: number) => void;
  /** Number reported while the field is empty (default 0). */
  emptyValue?: number;
  /** Whole numbers only (stock, units, minutes…). */
  integer?: boolean;
};

const show = (v: Props["value"]) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? "" : String(v));

/**
 * Numeric field that can be cleared and retyped freely.
 *
 * The usual pattern `value={n} onChange={e => setN(parseFloat(e.target.value || "0"))}`
 * turns an empty field into 0 immediately, so the "0" can never be deleted and every
 * new number starts with it. Here the text typed is kept while the field has focus
 * (empty, "0.", "-"), and is normalised to the stored value when leaving the field.
 */
export function NumericInput({ value, onValueChange, emptyValue = 0, integer = false, onBlur, onFocus, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => show(value));
  const [focused, setFocused] = useState(false);

  // External changes (e.g. "Exacto", rates from elTOQUE) update the field when not typing
  useEffect(() => {
    if (!focused) setText(show(value));
  }, [value, focused]);

  return (
    <input
      ref={ref}
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      {...rest}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        setText(show(value));
        onBlur?.(e);
      }}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        if (t.trim() === "" || t === "-" || t === ".") {
          onValueChange(emptyValue);
          return;
        }
        const n = integer ? parseInt(t, 10) : parseFloat(t);
        if (!Number.isNaN(n)) onValueChange(n);
      }}
    />
  );
}
