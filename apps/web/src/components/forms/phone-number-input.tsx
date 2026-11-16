"use client";

import { useMemo } from "react";
import {
  getPhoneCallingCode,
  isPhoneCountrySupported,
  splitPhoneNumber,
} from "@contractflow/contracts-schema/phone";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  useComboboxAnchor,
} from "@workspace/ui/components/combobox";
import { Input } from "@workspace/ui/components/input";
import { countryOptions } from "@/lib/countries";
import type { PhoneFieldValue } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { FormControlProps } from "@/components/forms/form-field";
import { optionMatchesSearch } from "@/components/forms/searchable-select";
import { CountryFlag } from "@/components/forms/country-flag";

export interface PhoneCountryOption {
  /** ISO 3166-1 alpha-2 code: the value stored in the form. */
  code: string;
  name: string;
  /** International calling code without `+`, e.g. `"234"`. */
  callingCode: string;
}

/**
 * Every supported country with its calling code, alphabetical. Countries
 * that share a code (the United States and Canada on +1) are separate
 * options, since each has its own numbering ranges.
 */
export const phoneCountryOptions: readonly PhoneCountryOption[] =
  countryOptions.flatMap(({ code, name }) => {
    const callingCode = getPhoneCallingCode(code);
    return callingCode && isPhoneCountrySupported(code)
      ? [{ code, name, callingCode }]
      : [];
  });

/**
 * Whether a country matches a search: by calling code when the search is a
 * number (`+44`, `44`, `0044`), otherwise by name or ISO code.
 */
export function phoneCountryMatchesSearch(
  option: PhoneCountryOption,
  query: string,
): boolean {
  const text = query.trim();
  if (/^(\+|00)?[\d\s]+$/.test(text)) {
    const digits = text.replace(/^(\+|00)/, "").replace(/\s/g, "");
    return option.callingCode.startsWith(digits);
  }
  return optionMatchesSearch(
    { value: option.code, label: option.name, keywords: [option.code] },
    text,
  );
}

export interface PhoneNumberInputProps extends Partial<FormControlProps> {
  /**
   * The country (ISO 3166-1 alpha-2, `""` before one is chosen) and the
   * number as typed, without the calling code.
   */
  value: PhoneFieldValue;
  onValueChange: (value: PhoneFieldValue) => void;
  onBlur?: () => void;
  /** Field names for native form data and focus lookups. */
  countryName?: string;
  nationalNumberName?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * An international phone field: a searchable country picker showing the
 * flag and calling code, beside the national number. The label's `id` goes
 * to the number input; the picker has its own accessible name.
 *
 * The country and number stay separate; `phoneToE164` combines them. A
 * number pasted with its calling code (`+44 20 7946 0958`) moves the picker
 * to that country on blur. Changing the country never clears the number.
 */
export function PhoneNumberInput({
  value,
  onValueChange,
  onBlur,
  countryName,
  nationalNumberName,
  disabled = false,
  required = false,
  placeholder = "Phone number",
  className,
  id,
  ...aria
}: PhoneNumberInputProps) {
  const { countryCode, nationalNumber } = value;
  const anchor = useComboboxAnchor();
  const selected = useMemo(
    () =>
      phoneCountryOptions.find((option) => option.code === countryCode) ?? null,
    [countryCode],
  );
  const pickerLabel = selected
    ? `Phone country code: ${selected.name} +${selected.callingCode}`
    : "Phone country code: not selected";

  function handleBlur() {
    const text = nationalNumber.trim();
    if (text.startsWith("+") || text.startsWith("00")) {
      const parts = splitPhoneNumber(text);
      if (parts.recognized && parts.countryCode) {
        onValueChange({
          countryCode: parts.countryCode,
          nationalNumber: parts.nationalNumber,
        });
      }
    }
    onBlur?.();
  }

  return (
    <div
      ref={anchor}
      data-slot="phone-number-input"
      className={cn("flex w-full min-w-0 gap-2", className)}
    >
      <Combobox<PhoneCountryOption>
        items={phoneCountryOptions}
        value={selected}
        onValueChange={(option) => {
          if (option && option.code !== countryCode) {
            onValueChange({ countryCode: option.code, nationalNumber });
          }
        }}
        itemToStringLabel={(option) => option.name}
        itemToStringValue={(option) => option.code}
        isItemEqualToValue={(option, current) => option.code === current.code}
        filter={phoneCountryMatchesSearch}
        name={countryName}
        required={required}
        disabled={disabled}
        autoHighlight
      >
        <ComboboxTrigger
          type="button"
          aria-label={pickerLabel}
          aria-describedby={aria["aria-describedby"]}
          aria-invalid={aria["aria-invalid"]}
          disabled={disabled}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl border border-field-border bg-input/50 ps-3 pe-2 text-sm transition-[color,box-shadow] duration-200 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
        >
          <CountryFlag countryCode={selected?.code ?? ""} />
          <span
            className={cn(
              "min-w-9 text-start tabular-nums",
              !selected && "text-muted-foreground",
            )}
          >
            {selected ? `+${selected.callingCode}` : "Code"}
          </span>
        </ComboboxTrigger>
        <ComboboxContent anchor={anchor} className="sm:min-w-80">
          <ComboboxInput
            showTrigger={false}
            aria-label="Search countries"
            placeholder="Search country or code"
          />
          <ComboboxEmpty>No countries match your search.</ComboboxEmpty>
          <ComboboxList>
            {(option: PhoneCountryOption) => (
              <ComboboxItem key={option.code} value={option}>
                <CountryFlag countryCode={option.code} />
                <span className="min-w-0 flex-1 truncate">{option.name}</span>
                <span className="text-muted-foreground tabular-nums">
                  +{option.callingCode}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <Input
        id={id}
        {...aria}
        name={nationalNumberName}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        maxLength={40}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        value={nationalNumber}
        onChange={(event) =>
          onValueChange({ countryCode, nationalNumber: event.target.value })
        }
        onBlur={handleBlur}
        className="flex-1"
      />
    </div>
  );
}
