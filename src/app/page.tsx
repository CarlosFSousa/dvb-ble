import { APP_VERSION } from "@/version";

export default function Home() {
  return (
    <section>
      <h1 className="text-2xl">Welcome to Ble Scanner v{APP_VERSION}</h1>
      <p>Please select Transfer,Firmware or Production from the navigation bar to begin.</p>
    </section>
  );
}
