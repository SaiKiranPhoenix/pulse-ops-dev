import { ToastProvider } from "@/components/ui/toast";
import { AppRoutes } from "@/routes/AppRoutes";

export function App() {
  return (
    <ToastProvider>
      <AppRoutes />
    </ToastProvider>
  );
}
