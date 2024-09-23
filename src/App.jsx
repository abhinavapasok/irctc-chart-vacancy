import { useState } from "react";
import IRCTCApiComponent from "./components/IRCTCApiComponent";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <IRCTCApiComponent />
    </>
  );
}

export default App;
