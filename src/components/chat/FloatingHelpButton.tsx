import { Phone, MessageCircle } from "lucide-react";

interface FloatingHelpButtonProps {
  phoneNumber?: string;
}

const FloatingHelpButton = ({ phoneNumber = "7600504810" }: FloatingHelpButtonProps) => {
  const handleWhatsApp = () => {
    window.open(`https://wa.me/91${phoneNumber}?text=Hi! I need help with ChekInn`, "_blank");
  };

  const handleCall = () => {
    window.location.href = `tel:+91${phoneNumber}`;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {/* WhatsApp Button */}
      <button
        onClick={handleWhatsApp}
        className="flex items-center gap-2 px-4 py-3 rounded-full bg-green-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline">Need help?</span>
      </button>
    </div>
  );
};

export default FloatingHelpButton;