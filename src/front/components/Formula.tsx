import katex from "katex";
import { useMemo } from "react";

type FormulaProps = {
    latex: string;
    className?: string;
};

export function Formula({ latex, className }: FormulaProps) {
    const html = useMemo(
        () => katex.renderToString(latex, {
            displayMode: true,
            throwOnError: false,
        }),
        [latex],
    );

    return <div dangerouslySetInnerHTML={{ __html: html }} className={className} />;
}