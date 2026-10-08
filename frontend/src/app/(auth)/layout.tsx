import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-panel px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Brand className="text-lg" />
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
