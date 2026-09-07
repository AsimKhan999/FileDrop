import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import UploadPage from "./pages/UploadPage";
import SharePage from "./pages/SharePage";
import P2PTransfer from "./pages/P2PTransfer";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <>
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/share/:token" element={<SharePage />} />
          <Route path="/p2p" element={<P2PTransfer onBack={() => window.location.href = "/"} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

export default App;
