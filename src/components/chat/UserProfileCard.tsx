import { motion } from "framer-motion";
import { User, Briefcase, Target, Sparkles, CheckCircle } from "lucide-react";

interface UserProfileCardProps {
  profile: {
    full_name?: string | null;
    role?: string | null;
    industry?: string | null;
    looking_for?: string | null;
    skills?: string[] | null;
    interests?: string[] | null;
    ai_insights?: {
      summary?: string;
    } | null;
  };
}

const UserProfileCard = ({ profile }: UserProfileCardProps) => {
  const hasContent = profile.full_name || profile.role || profile.looking_for || profile.ai_insights?.summary;
  
  if (!hasContent) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-4 p-4 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-full bg-primary/20">
          <CheckCircle className="w-4 h-4 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground">Your Profile</span>
        <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-auto">
          Ready for intros
        </span>
      </div>

      <div className="space-y-3">
        {/* Name & Role */}
        {(profile.full_name || profile.role) && (
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              {profile.full_name && (
                <p className="text-sm font-medium text-foreground">{profile.full_name}</p>
              )}
              {profile.role && (
                <p className="text-xs text-muted-foreground">{profile.role}</p>
              )}
            </div>
          </div>
        )}

        {/* Industry */}
        {profile.industry && (
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-foreground">{profile.industry}</p>
          </div>
        )}

        {/* Looking for */}
        {profile.looking_for && (
          <div className="flex items-start gap-2">
            <Target className="w-4 h-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-foreground">{profile.looking_for}</p>
          </div>
        )}

        {/* AI Summary */}
        {profile.ai_insights?.summary && (
          <div className="flex items-start gap-2 pt-2 border-t border-primary/10">
            <Sparkles className="w-4 h-4 text-primary mt-0.5" />
            <p className="text-sm text-muted-foreground italic">
              "{profile.ai_insights.summary}"
            </p>
          </div>
        )}

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {profile.skills.slice(0, 4).map((skill, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default UserProfileCard;