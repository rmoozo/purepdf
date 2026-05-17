import { useState, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000';

function App() {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [converting, setConverting] = useState(false);
  const [history, setHistory] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [piUser, setPiUser] = useState(null);
  const [tipping, setTipping] = useState(false);
  const [tipStatus, setTipStatus] = useState(null);
  const inputRef = useRef();

  const approvePaymentBackend = async (paymentId) => {
    const res = await fetch(`${API_BASE}/api/payments/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId }),
    });
    if (!res.ok) throw new Error('Approve failed');
    return res.json();
  };

  const completePaymentBackend = async (paymentId) => {
    const res = await fetch(`${API_BASE}/api/payments/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId }),
    });
    if (!res.ok) throw new Error('Complete failed');
    return res.json();
  };

  const onIncompletePaymentFound = async (payment) => {
    try {
      await approvePaymentBackend(payment.identifier);
      await completePaymentBackend(payment.identifier);
    } catch (e) {
      console.log('Failed to complete incomplete payment', e);
    }
  };

  useEffect(() => {
    const initPi = async () => {
      try {
        await window.Pi.init({ version: "2.0", sandbox: true });
        const auth = await window.Pi.authenticate(['username', 'payments'], onIncompletePaymentFound);
        setPiUser(auth.user.username);
      } catch (e) {
        console.log('Pi auth failed', e);
      }
    };
    if (window.Pi) initPi();
  }, []);

  const handleTip = async () => {
    if (!window.Pi) return;
    setTipping(true);
    setTipStatus(null);
    try {
      const payment = await window.Pi.createPayment({
        amount: 1,
        memo: 'Tip for PurePDF',
        metadata: { product: 'tip' },
      }, {
        onReadyForServerApproval: async (paymentId) => {
          await approvePaymentBackend(paymentId);
        },
        onReadyForServerCompletion: async (paymentId, txid) => {
          await completePaymentBackend(paymentId);
          setTipStatus('Thank you for your tip!');
        },
        onCancel: (paymentId) => {
          setTipStatus('Payment cancelled.');
        },
        onError: (error, payment) => {
          console.error('Payment error', error, payment);
          setTipStatus('Payment failed. Please try again.');
        },
      });
    } catch (e) {
      console.log('Tip error', e);
      setTipStatus('Payment failed. Please try again.');
    } finally {
      setTipping(false);
    }
  };

  const handleFile = (f) => {
    setFile(f);
    setPdfUrl(null);
    setProgress(0);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const downloadPdf = (url, name) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const convertToPDF = async () => {
    if (!file) return;
    setConverting(true);
    setProgress(0);

    const doc = new jsPDF();
    const type = file.type;

    for (let i = 0; i <= 80; i += 20) {
      await new Promise(r => setTimeout(r, 200));
      setProgress(i);
    }

    if (type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = e.target.result;
        doc.addImage(img, 'JPEG', 10, 10, 190, 150);
        setProgress(100);
        const url = doc.output('datauristring');
        setPdfUrl(url);
        setHistory(h => [{
          name: file.name,
          date: new Date().toLocaleString('ar-SA'),
          url
        }, ...h.slice(0, 9)]);
        setConverting(false);
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = doc.splitTextToSize(text, 180);
        doc.setFontSize(12);
        doc.text(lines, 15, 20);
        setProgress(100);
        const url = doc.output('datauristring');
        setPdfUrl(url);
        setHistory(h => [{
          name: file.name,
          date: new Date().toLocaleString('ar-SA'),
          url
        }, ...h.slice(0, 9)]);
        setConverting(false);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', padding: '20px', textAlign: 'center' }}>
        <h1 style={{ color: 'white', fontSize: '2rem', margin: 0 }}>📄 PurePDF</h1>
        <p style={{ color: '#c4b5fd', margin: '5px 0 0' }}>Convert your files to PDF instantly</p>
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}>
          {piUser ? (
            <>
              <span style={{ color: '#c4b5fd', fontSize: '14px' }}>👤 {piUser}</span>
              <button
                onClick={handleTip}
                disabled={tipping}
                style={{
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  fontWeight: 'bold',
                  cursor: tipping ? 'not-allowed' : 'pointer',
                  opacity: tipping ? 0.7 : 1,
                }}
              >
                {tipping ? 'Processing...' : '💛 Tip 1 Pi'}
              </button>
            </>
          ) : (
            <button
              onClick={() => window.Pi && window.Pi.authenticate(['username', 'payments'], onIncompletePaymentFound)}
              style={{ background: 'white', color: '#4f46e5', border: 'none', borderRadius: '8px', padding: '6px 14px', fontWeight: 'bold', cursor: 'pointer' }}>
              Sign in with Pi
            </button>
          )}
        </div>
        {tipStatus && (
          <div style={{ marginTop: '8px', color: '#fde68a', fontSize: '14px' }}>{tipStatus}</div>
        )}
      </div>

      <div style={{ maxWidth: '700px', margin: '40px auto', padding: '0 20px' }}>
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '10px', padding: '12px', marginBottom: '20px', textAlign: 'center', color: '#065f46', fontSize: '14px' }}>
          🔒 Your files are processed locally and never uploaded to any server
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current.click()}
          style={{
            border: `2px dashed ${dragOver ? '#4f46e5' : '#a5b4fc'}`,
            borderRadius: '16px',
            padding: '50px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? '#eef2ff' : 'white',
            transition: 'all 0.3s'
          }}
        >
          <div style={{ fontSize: '3rem' }}>📁</div>
          <p style={{ color: '#4f46e5', fontWeight: 'bold', fontSize: '1.1rem' }}>
            {file ? `✅ ${file.name}` : 'Drag & Drop or Click to Upload'}
          </p>
          <p style={{ color: '#9ca3af', fontSize: '13px' }}>Supports: JPG, PNG, TXT, CSV</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.txt,.csv"
            multiple={false}
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>

        {file && (
          <button
            onClick={convertToPDF}
            disabled={converting}
            style={{
              width: '100%',
              marginTop: '20px',
              padding: '15px',
              background: converting ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: converting ? 'not-allowed' : 'pointer'
            }}
          >
            {converting ? 'Converting...' : '⚡ Convert to PDF'}
          </button>
        )}

        {converting && (
          <div style={{ marginTop: '15px', background: '#e0e7ff', borderRadius: '10px', height: '10px' }}>
            <div style={{ width: `${progress}%`, background: '#4f46e5', height: '10px', borderRadius: '10px', transition: 'width 0.3s' }} />
          </div>
        )}

        {pdfUrl && (
          <div style={{ marginTop: '30px', background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <h3 style={{ color: '#4f46e5', marginTop: 0 }}>✅ PDF Ready!</h3>
            <iframe src={pdfUrl} width="100%" height="400px" style={{ border: 'none', borderRadius: '8px' }} title="PDF Preview" />
            <button
              onClick={() => downloadPdf(pdfUrl, `${file?.name?.split('.')[0]}.pdf`)}
              style={{ width: '100%', marginTop: '15px', padding: '12px', background: '#059669', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>
              ⬇️ Download PDF
            </button>
          </div>
        )}

        {history.length > 0 && (
          <div style={{ marginTop: '30px', background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <h3 style={{ color: '#4f46e5', marginTop: 0 }}>🕘 Recent Conversions</h3>
            {history.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < history.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#374151' }}>📄 {h.name}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>{h.date}</div>
                </div>
                <button
                  onClick={() => downloadPdf(h.url, h.name.split('.')[0] + '.pdf')}
                  style={{ color: '#4f46e5', background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
                  ⬇️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
