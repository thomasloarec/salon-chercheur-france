import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CalendlyModalProps {
  url: string;
  onClose: () => void;
}

const CalendlyModal = ({ url, onClose }: CalendlyModalProps) => {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[720px] bg-[#0F1424] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-[#E6EAF3]">Réserver un rendez-vous</DialogTitle>
        </DialogHeader>
        <iframe
          src={url}
          width="100%"
          height="100%"
          frameBorder="0"
          title="Calendrier de réservation"
          className="rounded-lg"
        />
      </DialogContent>
    </Dialog>
  );
};

export default CalendlyModal;
