import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'hi';

interface Translations {
  appName: string;
  appTagline: string;
  disclaimerText: string;
  disclaimerTitle: string;
  // Navigation
  navSearch: string;
  navScan: string;
  navStores: string;
  navHistory: string;
  // Common states
  loading: string;
  retry: string;
  notConnectedTitle: string;
  notConnectedDesc: string;
  offlineNotice: string;
  // Page titles
  searchTitle: string;
  scanTitle: string;
  prescriptionTitle: string;
  storesTitle: string;
  historyTitle: string;
  // Search page
  searchPlaceholder: string;
  searchAriaLabel: string;
  searchHelpText: string;
  // Scan page
  scanSubtitle: string;
  uploadButton: string;
  cameraButton: string;
  ocrNotice: string;
  // Prescription detail
  prescriptionSubtitle: string;
  estimatedSavingNotice: string;
  printSlip: string;
  callPatient: string;
  // Stores page
  storesSubtitle: string;
  selectCity: string;
  useLocation: string;
  // History page
  historySubtitle: string;
  emptyHistoryTitle: string;
  emptyHistoryDesc: string;
  localOnlyWarning: string;
}

const translations: Record<Language, Translations> = {
  en: {
    appName: 'AushadhAi',
    appTagline: 'Make medicine costs visible before you pay',
    disclaimerTitle: 'Medical Notice',
    disclaimerText: 'Informational only — confirm with doctor or pharmacist before substituting.',
    navSearch: 'Search & Compare',
    navScan: 'Scan Strip',
    navStores: 'Find Kendra',
    navHistory: 'Saved History',
    loading: 'Loading information…',
    retry: 'Retry',
    notConnectedTitle: 'Ready for Connection',
    notConnectedDesc: 'Frontend foundation active. Awaiting backend verified data connection.',
    offlineNotice: 'Offline mode — using cached app shell',
    searchTitle: 'Search Medicine & Compare Prices',
    searchPlaceholder: 'Search brand (e.g. Dolo) or molecule (Paracetamol)…',
    searchAriaLabel: 'Search brand or molecule name',
    searchHelpText: 'Enter brand or molecule name to view verified PMBJP generic pricing and savings.',
    scanTitle: 'Scan Prescription or Medicine Strip',
    scanSubtitle: 'Upload a medicine box or prescription for OCR review and manual verification.',
    uploadButton: 'Choose Photo or Document',
    cameraButton: 'Take Photo',
    ocrNotice: 'OCR extracted text is unconfirmed. You must verify and select every medicine manually.',
    prescriptionTitle: 'Confirmed Prescription Report',
    prescriptionSubtitle: 'Review verified medicine substitutions, basket totals, and reminders.',
    estimatedSavingNotice: 'Savings are estimated potential savings based on verified comparable pack prices.',
    printSlip: 'Print Chemist Slip',
    callPatient: 'Call Patient (Outbound)',
    storesTitle: 'Find Jan Aushadhi Kendras',
    storesSubtitle: 'Locate genuine PMBJP Kendras with verified addresses and driving routes.',
    selectCity: 'Select City',
    useLocation: 'Use My Current Location',
    historyTitle: 'Device-Local Report History',
    historySubtitle: 'Locally stored prescription summaries on this device. No account or cloud sync.',
    emptyHistoryTitle: 'No saved reports yet',
    emptyHistoryDesc: 'Confirmed reports you generate on this phone will appear here for reprint and review.',
    localOnlyWarning: 'Notice: Reports are saved strictly in this browser. Clearing website data will remove local history.'
  },
  hi: {
    appName: 'औषध-एआई (AushadhAi)',
    appTagline: 'दवा का मूल्य भुगतान करने से पहले जानें',
    disclaimerTitle: 'चिकित्सा सूचना',
    disclaimerText: 'केवल सूचनात्मक — दवा बदलने से पहले डॉक्टर या फार्मासिस्ट से पुष्टि करें।',
    navSearch: 'खोजें व तुलना करें',
    navScan: 'दवा स्कैन करें',
    navStores: 'केंद्र खोजें',
    navHistory: 'सहेजा इतिहास',
    loading: 'जानकारी लोड हो रही है…',
    retry: 'पुनः प्रयास करें',
    notConnectedTitle: 'कनेक्शन हेतु तैयार',
    notConnectedDesc: 'फ़्रंटएंड बुनियादी ढांचा सक्रिय है। बैकएंड सत्यापित डेटा कनेक्शन की प्रतीक्षा है।',
    offlineNotice: 'ऑफ़लाइन मोड — कैश्ड ऐप शेल का उपयोग हो रहा है',
    searchTitle: 'दवा खोजें और मूल्य तुलना देखें',
    searchPlaceholder: 'ब्रांड (जैसे डोलो) या मूल घटक (पैरासिटामोल) लिखें…',
    searchAriaLabel: 'ब्रांड या मूल घटक नाम खोजें',
    searchHelpText: 'सत्यापित जन औषधि (PMBJP) मूल्य और संभावित बचत देखने के लिए नाम दर्ज करें।',
    scanTitle: 'दवा की पट्टी या पर्चा स्कैन करें',
    scanSubtitle: 'समीक्षा और हस्तचालित पुष्टि के लिए दवा के डिब्बे या पर्चे की तस्वीर अपलोड करें।',
    uploadButton: 'फोटो या दस्तावेज चुनें',
    cameraButton: 'कैमरे से फोटो लें',
    ocrNotice: 'स्कैन से पढ़ा गया पाठ अपुष्ट है। प्रत्येक दवा की स्वयं पुष्टि करना अनिवार्य है।',
    prescriptionTitle: 'पुष्ट दवा रिपोर्ट',
    prescriptionSubtitle: 'सत्यापित जेनेरिक विकल्प, कुल मूल्य और दवा स्मरण की समीक्षा करें।',
    estimatedSavingNotice: 'बचत केवल समतुल्य पैक कीमतों के आधार पर आकलित संभावित बचत है।',
    printSlip: 'केमिस्ट पर्ची प्रिंट करें',
    callPatient: 'मरीज को कॉल करें',
    storesTitle: 'जन औषधि केंद्र खोजें',
    storesSubtitle: 'सत्यापित पते और मार्ग के साथ निकटतम आधिकारिक केंद्र खोजें।',
    selectCity: 'शहर चुनें',
    useLocation: 'मेरा वर्तमान स्थान उपयोग करें',
    historyTitle: 'डिवाइस में सहेजी गई रिपोर्ट',
    historySubtitle: 'इस फ़ोन पर स्थानीय रूप से सुरक्षित विवरण। कोई लॉगिन या क्लाउड सिंक नहीं।',
    emptyHistoryTitle: 'अभी तक कोई रिपोर्ट नहीं है',
    emptyHistoryDesc: 'इस फ़ोन पर बनाई गई पुष्ट रिपोर्ट यहाँ पुनः देखने और प्रिंट करने के लिए मिलेंगी।',
    localOnlyWarning: 'ध्यान दें: रिपोर्ट केवल इस ब्राउज़र में रहती हैं। ब्राउज़र डेटा साफ़ करने पर इतिहास हट जाएगा।'
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('aushadh_lang');
      return saved === 'hi' ? 'hi' : 'en';
    } catch {
      return 'en';
    }
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('aushadh_lang', lang);
    } catch {
      // LocalStorage might be disabled
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
