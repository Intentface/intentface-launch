import { useCallback, useRef, useState } from "react";

type UseCopyOptions = {
  timeout?: number;
};

export const useCopy = ({ timeout = 2000 }: UseCopyOptions = {}) => {
  const [copied, setCopied] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const copy = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(value);

        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Set new timeout to clear copied state
        timeoutRef.current = setTimeout(() => {
          setCopied(null);
        }, timeout);
      } catch (error) {
        console.error("Failed to copy to clipboard:", error);
        setCopied(null);
      }
    },
    [timeout],
  );

  const isCopied = copied !== null;

  return { copy, copied, isCopied };
};
