import { Heart, MessageCircle, Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NoveltyInteractionBarProps {
  likesCount: number;
  isLiked: boolean;
  commentsCount: number;
  showComments: boolean;
  hasDownload: boolean;
  onLikeToggle: (e?: React.MouseEvent) => void;
  onCommentsToggle: (e?: React.MouseEvent) => void;
  onMeetingRequest: (e?: React.MouseEvent) => void;
  onBrochureDownload?: (e?: React.MouseEvent) => void;
  isPending?: boolean;
}

export default function NoveltyInteractionBar({
  likesCount,
  isLiked,
  commentsCount,
  showComments,
  hasDownload,
  onLikeToggle,
  onCommentsToggle,
  onMeetingRequest,
  onBrochureDownload,
  isPending = false,
}: NoveltyInteractionBarProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-b">
      {/* Section interactions sociales - minimaliste à gauche */}
      <div className="flex items-center gap-3">
        <Button
          onClick={onLikeToggle}
          variant="ghost"
          size="sm"
          disabled={isPending}
          className={cn(
            "flex items-center gap-1.5 hover:bg-accent/50 text-muted-foreground h-8 px-2",
            isLiked && "text-primary"
          )}
        >
          <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
          <span className="text-sm">{likesCount}</span>
        </Button>

        <Button
          onClick={onCommentsToggle}
          variant="ghost"
          size="sm"
          className={cn(
            "flex items-center gap-1.5 hover:bg-accent/50 text-muted-foreground h-8 px-2",
            showComments && "text-primary"
          )}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm">{commentsCount}</span>
        </Button>
      </div>

      {/* Section boutons d'action CTA - alignés à droite */}
      <div className="flex items-center gap-2">
        <Button
          onClick={onMeetingRequest}
          variant="default"
          size="sm"
          className="flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow"
        >
          <Calendar className="h-4 w-4" />
          <span className="font-medium hidden sm:inline">Prendre RDV</span>
          <span className="font-medium sm:hidden">RDV</span>
        </Button>

        {hasDownload && onBrochureDownload && (
          <Button
            onClick={onBrochureDownload}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow"
          >
            <Download className="h-4 w-4" />
            <span className="font-medium hidden sm:inline">Télécharger</span>
            <span className="font-medium sm:hidden">Brochure</span>
          </Button>
        )}
      </div>
    </div>
  );
}
