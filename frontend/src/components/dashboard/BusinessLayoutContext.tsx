"use client";

import { createContext, useContext, type ReactNode } from "react";

type BusinessLayoutContextValue = {
  businessId: string;
  businessName: string;
};

const BusinessLayoutContext = createContext<BusinessLayoutContextValue>({
  businessId: "",
  businessName: "",
});

export function useBusinessLayout() {
  return useContext(BusinessLayoutContext);
}

export function BusinessLayoutProvider({
  businessId,
  businessName,
  children,
}: BusinessLayoutContextValue & { children: ReactNode }) {
  return (
    <BusinessLayoutContext.Provider value={{ businessId, businessName }}>
      {children}
    </BusinessLayoutContext.Provider>
  );
}
