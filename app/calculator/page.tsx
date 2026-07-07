import { Suspense } from "react";
import { CalculatorClient } from "./CalculatorClient";

export default function CalculatorPage() {
  return (
    <Suspense fallback={null}>
      <CalculatorClient />
    </Suspense>
  );
}
