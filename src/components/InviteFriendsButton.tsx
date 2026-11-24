import { Alert, Share } from 'react-native';

import { Button } from './Button';
import { useProfile } from '@/data/profile';
import { inviteMessage } from '@/domain/invite';

/**
 * Opens the share sheet with a link to Rust Strength on the App Store and,
 * once you've chosen one, your @username, so the person you invite can find
 * you. Closing the share sheet without sending resolves normally and says
 * nothing; only a share sheet that can't open shows an alert.
 */
export function useInviteFriends(): () => void {
  const profile = useProfile();
  return () => {
    Share.share({
      message: inviteMessage({
        username: profile.data?.username,
        usernameChosen: profile.data?.username_chosen,
      }),
    }).catch(() => Alert.alert('Couldn’t open the share sheet', 'Please try again.'));
  };
}

export function InviteFriendsButton({
  variant = 'secondary',
  label = 'Invite friends',
}: {
  variant?: 'primary' | 'secondary' | 'ghost';
  label?: string;
}) {
  const invite = useInviteFriends();
  return <Button label={label} variant={variant} onPress={invite} />;
}
