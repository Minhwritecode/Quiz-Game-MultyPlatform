import { faApple } from '@fortawesome/free-brands-svg-icons/faApple';
import { faFacebookF } from '@fortawesome/free-brands-svg-icons/faFacebookF';
import { faGoogle } from '@fortawesome/free-brands-svg-icons/faGoogle';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
// Import individual icons so Metro does not include either library's entire catalog.
import Activity from 'lucide-react-native/icons/activity';
import Archive from 'lucide-react-native/icons/archive';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowLeftRight from 'lucide-react-native/icons/arrow-left-right';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import Ban from 'lucide-react-native/icons/ban';
import BookMarked from 'lucide-react-native/icons/book-bookmark';
import BowArrow from 'lucide-react-native/icons/bow-arrow';
import BriefcaseBusiness from 'lucide-react-native/icons/briefcase-business';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Camera from 'lucide-react-native/icons/camera';
import ChartNoAxesColumnIncreasing from 'lucide-react-native/icons/chart-no-axes-column-increasing';
import ChartNoAxesCombined from 'lucide-react-native/icons/chart-no-axes-combined';
import Check from 'lucide-react-native/icons/check';
import CheckCheck from 'lucide-react-native/icons/check-check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import Circle from 'lucide-react-native/icons/circle';
import CircleAlert from 'lucide-react-native/icons/circle-exclamation-point';
import CircleArrowUp from 'lucide-react-native/icons/circle-arrow-up';
import CircleCheckBig from 'lucide-react-native/icons/circle-check-big';
import CircleChevronRight from 'lucide-react-native/icons/circle-chevron-right';
import CircleDot from 'lucide-react-native/icons/circle-dot';
import CirclePause from 'lucide-react-native/icons/circle-pause';
import CirclePlus from 'lucide-react-native/icons/circle-plus';
import CircleQuestionMark from 'lucide-react-native/icons/circle-question-mark';
import CircleStop from 'lucide-react-native/icons/circle-stop';
import CircleUserRound from 'lucide-react-native/icons/circle-user-round';
import CircleX from 'lucide-react-native/icons/circle-x';
import Clock3 from 'lucide-react-native/icons/clock-3';
import Cloud from 'lucide-react-native/icons/cloud';
import CloudOff from 'lucide-react-native/icons/cloud-off';
import CloudUpload from 'lucide-react-native/icons/cloud-upload';
import CodeXml from 'lucide-react-native/icons/code-xml';
import Copy from 'lucide-react-native/icons/copy';
import CopyPlus from 'lucide-react-native/icons/copy-plus';
import Cpu from 'lucide-react-native/icons/cpu';
import CreditCard from 'lucide-react-native/icons/credit-card';
import Download from 'lucide-react-native/icons/download';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import File from 'lucide-react-native/icons/file';
import FilePlus from 'lucide-react-native/icons/file-plus';
import FileText from 'lucide-react-native/icons/file-text';
import Film from 'lucide-react-native/icons/film';
import Fingerprint from 'lucide-react-native/icons/fingerprint-pattern';
import Flag from 'lucide-react-native/icons/flag';
import Monitor from 'lucide-react-native/icons/monitor';
import Folder from 'lucide-react-native/icons/folder';
import FolderOpen from 'lucide-react-native/icons/folder-open';
import Frown from 'lucide-react-native/icons/face-slightly-frowning';
import Globe from 'lucide-react-native/icons/globe';
import Hand from 'lucide-react-native/icons/hand';
import HeartCrack from 'lucide-react-native/icons/heart-crack';
import Hourglass from 'lucide-react-native/icons/hourglass';
import Image from 'lucide-react-native/icons/image';
import Images from 'lucide-react-native/icons/images';
import Info from 'lucide-react-native/icons/info';
import KeyRound from 'lucide-react-native/icons/key-round';
import Languages from 'lucide-react-native/icons/languages';
import Laptop from 'lucide-react-native/icons/laptop';
import Layers from 'lucide-react-native/icons/layers';
import LayoutGrid from 'lucide-react-native/icons/layout-grid';
import Link from 'lucide-react-native/icons/link';
import LocateFixed from 'lucide-react-native/icons/locate-fixed';
import LockKeyhole from 'lucide-react-native/icons/lock-keyhole';
import LogIn from 'lucide-react-native/icons/log-in';
import LogOut from 'lucide-react-native/icons/log-out';
import Mail from 'lucide-react-native/icons/mail';
import MapPin from 'lucide-react-native/icons/map-pin';
import Megaphone from 'lucide-react-native/icons/megaphone';
import Menu from 'lucide-react-native/icons/menu';
import Mic from 'lucide-react-native/icons/mic';
import Minus from 'lucide-react-native/icons/minus';
import Move from 'lucide-react-native/icons/move';
import Newspaper from 'lucide-react-native/icons/newspaper';
import PanelsTopLeft from 'lucide-react-native/icons/panels-top-left';
import Pause from 'lucide-react-native/icons/pause';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import QrCode from 'lucide-react-native/icons/qr-code';
import Radio from 'lucide-react-native/icons/radio';
import Redo2 from 'lucide-react-native/icons/redo-2';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Repeat2 from 'lucide-react-native/icons/repeat-2';
import RotateCw from 'lucide-react-native/icons/rotate-cw';
import Save from 'lucide-react-native/icons/save';
import Search from 'lucide-react-native/icons/search';
import Send from 'lucide-react-native/icons/send';
import SendHorizontal from 'lucide-react-native/icons/send-horizontal';
import Server from 'lucide-react-native/icons/server';
import Share from 'lucide-react-native/icons/share';
import Share2 from 'lucide-react-native/icons/share-2';
import Shuffle from 'lucide-react-native/icons/shuffle';
import Signal from 'lucide-react-native/icons/signal';
import SkipForward from 'lucide-react-native/icons/skip-forward';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import Smartphone from 'lucide-react-native/icons/smartphone';
import Snowflake from 'lucide-react-native/icons/snowflake';
import Square from 'lucide-react-native/icons/square';
import SquareCheck from 'lucide-react-native/icons/square-check';
import SwitchCamera from 'lucide-react-native/icons/switch-camera';
import Tablet from 'lucide-react-native/icons/tablet';
import Timer from 'lucide-react-native/icons/timer';
import Trash from 'lucide-react-native/icons/trash';
import Trash2 from 'lucide-react-native/icons/trash';
import TrendingDown from 'lucide-react-native/icons/trending-down';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import TriangleAlert from 'lucide-react-native/icons/triangle-exclamation-point';
import Type from 'lucide-react-native/icons/type';
import Undo2 from 'lucide-react-native/icons/undo-2';
import UserRound from 'lucide-react-native/icons/user-round';
import UserRoundMinus from 'lucide-react-native/icons/user-round-minus';
import UserRoundPlus from 'lucide-react-native/icons/user-round-plus';
import Users from 'lucide-react-native/icons/users';
import Video from 'lucide-react-native/icons/video';
import Volume2 from 'lucide-react-native/icons/volume-2';
import VolumeX from 'lucide-react-native/icons/volume-x';
import Wifi from 'lucide-react-native/icons/wifi';
import X from 'lucide-react-native/icons/x';
import { BellIcon } from 'phosphor-react-native/src/icons/Bell';
import { BellSlashIcon } from 'phosphor-react-native/src/icons/BellSlash';
import { BookOpenIcon } from 'phosphor-react-native/src/icons/BookOpen';
import { BookmarkSimpleIcon } from 'phosphor-react-native/src/icons/BookmarkSimple';
import { BooksIcon } from 'phosphor-react-native/src/icons/Books';
import { ChatCircleDotsIcon } from 'phosphor-react-native/src/icons/ChatCircleDots';
import { ChatCircleIcon } from 'phosphor-react-native/src/icons/ChatCircle';
import { ChatsCircleIcon } from 'phosphor-react-native/src/icons/ChatsCircle';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { CubeIcon } from 'phosphor-react-native/src/icons/Cube';
import { DiamondIcon } from 'phosphor-react-native/src/icons/Diamond';
import { FireIcon } from 'phosphor-react-native/src/icons/Fire';
import { FlaskIcon } from 'phosphor-react-native/src/icons/Flask';
import { GameControllerIcon } from 'phosphor-react-native/src/icons/GameController';
import { GearSixIcon } from 'phosphor-react-native/src/icons/GearSix';
import { GiftIcon } from 'phosphor-react-native/src/icons/Gift';
import { GraduationCapIcon } from 'phosphor-react-native/src/icons/GraduationCap';
import { HeartIcon } from 'phosphor-react-native/src/icons/Heart';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { LeafIcon } from 'phosphor-react-native/src/icons/Leaf';
import { LightbulbIcon } from 'phosphor-react-native/src/icons/Lightbulb';
import { LightningIcon } from 'phosphor-react-native/src/icons/Lightning';
import { MoonIcon } from 'phosphor-react-native/src/icons/Moon';
import { PlanetIcon } from 'phosphor-react-native/src/icons/Planet';
import { PlayCircleIcon } from 'phosphor-react-native/src/icons/PlayCircle';
import { PlayIcon } from 'phosphor-react-native/src/icons/Play';
import { PuzzlePieceIcon } from 'phosphor-react-native/src/icons/PuzzlePiece';
import { RocketLaunchIcon } from 'phosphor-react-native/src/icons/RocketLaunch';
import { ShieldCheckIcon } from 'phosphor-react-native/src/icons/ShieldCheck';
import { ShieldIcon } from 'phosphor-react-native/src/icons/Shield';
import { ShapesIcon } from 'phosphor-react-native/src/icons/Shapes';
import { SkullIcon } from 'phosphor-react-native/src/icons/Skull';
import { SmileyIcon } from 'phosphor-react-native/src/icons/Smiley';
import { SparkleIcon } from 'phosphor-react-native/src/icons/Sparkle';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { TrophyIcon } from 'phosphor-react-native/src/icons/Trophy';
import { UsersThreeIcon } from 'phosphor-react-native/src/icons/UsersThree';

const utilityIcons = {
  'add': Plus,
  'add-circle': CirclePlus,
  'albums': PanelsTopLeft,
  'alert': CircleAlert,
  'alert-circle': CircleAlert,
  'analytics': ChartNoAxesCombined,
  'archive': Archive,
  'arrow-back': ArrowLeft,
  'arrow-down': ArrowDown,
  'arrow-forward': ArrowRight,
  'arrow-redo': Redo2,
  'arrow-undo': Undo2,
  'arrow-up': ArrowUp,
  'arrow-up-circle': CircleArrowUp,
  'ban': Ban,
  'bookmarks': BookMarked,
  'bow': BowArrow,
  'briefcase': BriefcaseBusiness,
  'calendar': CalendarDays,
  'camera': Camera,
  'camera-reverse': SwitchCamera,
  'card': CreditCard,
  'cellular': Signal,
  'checkbox': SquareCheck,
  'checkmark': Check,
  'checkmark-done': CheckCheck,
  'checkmark-done-circle': CircleCheckBig,
  'chevron-back': ChevronLeft,
  'chevron-down': ChevronDown,
  'chevron-forward': ChevronRight,
  'chevron-forward-circle': CircleChevronRight,
  'chevron-up': ChevronUp,
  'close': X,
  'close-circle': CircleX,
  'cloud': Cloud,
  'cloud-offline': CloudOff,
  'cloud-upload': CloudUpload,
  'code-slash': CodeXml,
  'copy': Copy,
  'create': Pencil,
  'document': File,
  'desktop': Monitor,
  'document-attach': FilePlus,
  'document-text': FileText,
  'download': Download,
  'duplicate': CopyPlus,
  'ellipse': Circle,
  'ellipsis-horizontal': Ellipsis,
  'enter': LogIn,
  'exit': LogOut,
  'eye': Eye,
  'eye-off': EyeOff,
  'film': Film,
  'finger-print': Fingerprint,
  'fitness': Activity,
  'flag': Flag,
  'folder': Folder,
  'folder-open': FolderOpen,
  'globe': Globe,
  'grid': LayoutGrid,
  'hand-left': Hand,
  'hardware-chip': Cpu,
  'heart-dislike': HeartCrack,
  'help-circle': CircleQuestionMark,
  'hourglass': Hourglass,
  'image': Image,
  'images': Images,
  'information-circle': Info,
  'key': KeyRound,
  'language': Languages,
  'laptop': Laptop,
  'layers': Layers,
  'link': Link,
  'locate': LocateFixed,
  'lock-closed': LockKeyhole,
  'log-in': LogIn,
  'log-out': LogOut,
  'mail': Mail,
  'megaphone': Megaphone,
  'menu': Menu,
  'mic': Mic,
  'move': Move,
  'newspaper': Newspaper,
  'open': ExternalLink,
  'options': SlidersHorizontal,
  'paper-plane': Send,
  'pause': Pause,
  'pause-circle': CirclePause,
  'people': Users,
  'person': UserRound,
  'person-add': UserRoundPlus,
  'person-circle': CircleUserRound,
  'person-remove': UserRoundMinus,
  'phone-portrait': Smartphone,
  'pin': MapPin,
  'play-forward': SkipForward,
  'qr-code': QrCode,
  'radio': Radio,
  'radio-button-off': Circle,
  'radio-button-on': CircleDot,
  'refresh': RotateCw,
  'refresh-circle': RefreshCw,
  'remove': Minus,
  'repeat': Repeat2,
  'sad': Frown,
  'save': Save,
  'search': Search,
  'send': SendHorizontal,
  'server': Server,
  'snow': Snowflake,
  'share': Share,
  'share-social': Share2,
  'shuffle': Shuffle,
  'square': Square,
  'stats-chart': ChartNoAxesColumnIncreasing,
  'stop': Square,
  'stop-circle': CircleStop,
  'swap-horizontal': ArrowLeftRight,
  'sync': RefreshCw,
  'tablet-portrait': Tablet,
  'text': Type,
  'time': Clock3,
  'timer': Timer,
  'trash': Trash2,
  'trash-bin': Trash,
  'trending-down': TrendingDown,
  'trending-up': TrendingUp,
  'videocam': Video,
  'volume-high': Volume2,
  'volume-mute': VolumeX,
  'warning': TriangleAlert,
  'wifi': Wifi,
};

const accentIcons = {
  'book': BookOpenIcon,
  'bookmark': BookmarkSimpleIcon,
  'bulb': LightbulbIcon,
  'chatbubble': ChatCircleIcon,
  'chatbubble-ellipses': ChatCircleDotsIcon,
  'chatbubbles': ChatsCircleIcon,
  'checkmark-circle': CheckCircleIcon,
  'cube': CubeIcon,
  'diamond': DiamondIcon,
  'extension-puzzle': PuzzlePieceIcon,
  'flame': FireIcon,
  'flash': LightningIcon,
  'flask': FlaskIcon,
  'game-controller': GameControllerIcon,
  'gift': GiftIcon,
  'happy': SmileyIcon,
  'heart': HeartIcon,
  'home': HouseIcon,
  'leaf': LeafIcon,
  'library': BooksIcon,
  'moon': MoonIcon,
  'notifications': BellIcon,
  'notifications-off': BellSlashIcon,
  'people-circle': UsersThreeIcon,
  'planet': PlanetIcon,
  'play': PlayIcon,
  'play-circle': PlayCircleIcon,
  'prism': ShapesIcon,
  'rocket': RocketLaunchIcon,
  'school': GraduationCapIcon,
  'settings': GearSixIcon,
  'shield': ShieldIcon,
  'shield-checkmark': ShieldCheckIcon,
  'skull': SkullIcon,
  'sparkles': SparkleIcon,
  'star': StarIcon,
  'trophy': TrophyIcon,
};

// Font Awesome Free brand artwork by Fonticons, Inc. (CC BY 4.0). https://fontawesome.com/license/free
const brandIcons = {
  'logo-apple': faApple,
  'logo-facebook': faFacebookF,
  'logo-google': faGoogle,
};

type UtilityName = keyof typeof utilityIcons;
type AccentName = keyof typeof accentIcons;
type BrandName = keyof typeof brandIcons;
type SymbolName = UtilityName | AccentName;
export type IconName = SymbolName | `${SymbolName}-outline` | BrandName;

type AppIconProps = {
  name: IconName;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  emphasized?: boolean;
};

export function AppIcon({ name, color = '#181C25', size = 24, style, emphasized }: AppIconProps) {
  const svgProps = {
    color,
    width: size,
    height: size,
    style,
    ...(Platform.OS !== 'web' ? { accessible: false } : null),
    'aria-hidden': true,
  } as const;
  if (Object.prototype.hasOwnProperty.call(brandIcons, name)) {
    const [width, height, , , path] = brandIcons[name as BrandName].icon;
    return (
      <Svg {...svgProps} viewBox={`0 0 ${width} ${height}`}>
        {[path].flat().map((segment) => <Path key={segment} d={segment} fill={color} />)}
      </Svg>
    );
  }

  const outlined = name.endsWith('-outline');
  const symbol = (outlined ? name.slice(0, -8) : name) as SymbolName;
  const Accent = (accentIcons as Partial<Record<SymbolName, typeof SparkleIcon>>)[symbol];
  if (Accent) {
    return <Accent {...svgProps} size={size} weight={(emphasized ?? !outlined) ? 'fill' : 'regular'} />;
  }

  const Utility = utilityIcons[symbol as UtilityName];
  return <Utility {...svgProps} size={size} strokeWidth={emphasized ? 2.5 : 1.9} />;
}
