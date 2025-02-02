import { useEffect, useRef, useState } from "react";

export default function App() {
  const [isDev, setIsDev] = useState(false);

  return (
    <>
      <nav>
        <h3>any-auth-web</h3>
      </nav>
      <main>
        <h1>Hello World</h1>
      </main>
    </>
  );
}
