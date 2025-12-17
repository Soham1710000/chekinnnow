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
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={handleWhatsApp}
        className="flex items-center justify-center w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-2 rounded-full bg-green-500 text-white shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="w-4 h-4 sm:w-4 sm:h-4" />
        <span className="text-xs font-medium hidden sm:inline sm:ml-1.5">Help</span>
      </button>
    </div>
  );
};

export default FloatingHelpButton;