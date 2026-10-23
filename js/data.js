// GHOST LAB — Codex of the Restless Dead
// Line format: Name|Origin|Class|Approx. first-recorded year (negative = BCE)|Short legend
// Every entry is matched to a Wikipedia article in wiki.js (lead text, link, Commons image).
import { hash, rng } from './rng.js';
import { WIKI } from './wiki.js';
import { traitsOf } from './traits.js';

export const REALMS = {
  EAST:     { name: 'Lantern Courts of the East',  short: 'East Asia',            color: '#e04848', angle: 0 },
  SEA:      { name: 'The Drowned Jungles',          short: 'Southeast Asia',       color: '#3fbf7f', angle: 1 },
  SOUTH:    { name: 'Ash Ghats of Sorrow',          short: 'South Asia & Tibet',   color: '#e0a030', angle: 2 },
  MIDEAST:  { name: 'Sand-Sealed Necropolis',       short: 'Middle East & Steppe', color: '#d8c070', angle: 3 },
  AFRICA:   { name: 'The Sunken Kingdoms',          short: 'Africa',               color: '#d07040', angle: 4 },
  EUROPE:   { name: 'Cathedral of Grey Ladies',     short: 'Europe',               color: '#8f8fd8', angle: 5 },
  AMERICAS: { name: 'Crossroads of the New World',  short: 'The Americas',         color: '#c05ad0', angle: 6 },
  OCEANIA:  { name: 'Shore of the Night Marchers',  short: 'Oceania & Pacific',    color: '#40a8d8', angle: 7 },
};

export const CLASSES = {
  WRAITH:      { glyph: '☠', voice: 'Grudge Pad',     desc: 'Vengeful dead. Long detuned pads that swell over the bar.' },
  BANSHEE:     { glyph: '♆', voice: 'Wail Lead',      desc: 'Omens and wailers. Gliding, screaming lead lines.' },
  POLTERGEIST: { glyph: '✷', voice: 'Knock Perc',     desc: 'Noisy tricksters. Metallic knocks, clicks and noise bursts.' },
  YOKAI:       { glyph: '✿', voice: 'Spirit Pluck',   desc: 'Shape-shifting spirits. Plucked pentatonic arpeggios.' },
  REVENANT:    { glyph: '⚰', voice: 'Acid Bass',      desc: 'Walking corpses. Squelching resonant acid basslines.' },
  SPECTER:     { glyph: '✧', voice: 'Grave Bell',     desc: 'Apparitions and lights. Cold FM bells.' },
  PHANTOM:     { glyph: '♀', voice: 'Veil Choir',     desc: 'Ladies in white and grey. Formant choir voices.' },
  SHADE:       { glyph: '◐', voice: 'Abyss Sub',      desc: 'Shadows and demons. Rumbling off-beat sub bass.' },
};

const RAW = {
EAST: `
Yūrei|Japan|PHANTOM|700|The archetypal Japanese ghost: white burial kimono, long loose black hair, limp hands and no feet, bound to the world by strong emotion.
Onryō|Japan|WRAITH|900|A vengeful spirit whose grudge is strong enough to kill, curse bloodlines and summon natural disasters.
Oiwa|Japan|WRAITH|1825|The disfigured, betrayed wife of the Yotsuya Kaidan, who haunts her murderous husband from lanterns and mirrors.
Okiku|Japan|BANSHEE|1741|A servant thrown into a well over a lost plate. Each night she counts plates to nine, then shrieks.
Kuchisake-onna|Japan|REVENANT|1979|A masked woman with a mouth slit ear to ear who asks strangers whether she is beautiful.
Hanako-san|Japan|POLTERGEIST|1950|A girl in a red skirt who answers knocks on the third stall of the school girls' toilet.
Teke Teke|Japan|REVENANT|1970|The upper half of a girl cut by a train, dragging herself on her elbows with a teke-teke sound.
Ubume|Japan|PHANTOM|1000|The ghost of a woman who died in childbirth, asking passers-by to hold her baby that grows heavy as stone.
Funayūrei|Japan|WRAITH|1600|Drowned sailors who rise from the sea demanding ladles, to fill and sink the ship.
Gashadokuro|Japan|SHADE|1700|A towering skeleton assembled from the bones of the starved, its teeth rattling in the dark.
Zashiki-warashi|Japan|POLTERGEIST|1800|A child spirit of old houses; fortune stays while it plays, and leaves when it does.
Noppera-bō|Japan|SPECTER|1700|A faceless ghost that appears as someone familiar, then wipes its face smooth as an egg.
Rokurokubi|Japan|YOKAI|1700|By day an ordinary woman; by night her neck stretches impossibly long through the house.
Nure-onna|Japan|YOKAI|1700|A serpent-bodied woman on the shore who hands travellers a bundle that will not let go.
Yuki-onna|Japan|PHANTOM|1400|The snow woman, pale and beautiful, whose icy breath freezes travellers lost in blizzards.
Kiyohime|Japan|WRAITH|928|A spurned woman who became a serpent and burned a fleeing monk alive inside a temple bell.
Taira no Masakado|Japan|WRAITH|940|A rebel warrior whose severed head flew home. His Tokyo grave is still treated with fearful respect.
Sugawara no Michizane|Japan|WRAITH|903|An exiled scholar whose onryō rained lightning on Kyoto until he was deified as Tenjin.
Emperor Sutoku|Japan|WRAITH|1164|An exiled emperor who wrote sutras in his own blood and became one of Japan's great onryō.
Ikiryō|Japan|SPECTER|1000|The wandering soul of a living person, like Lady Rokujō, who haunts rivals while she sleeps.
Hitodama|Japan|SPECTER|700|Blue-white fireballs with tails, said to be souls drifting from bodies at night.
Kosode-no-te|Japan|POLTERGEIST|1700|Pale hands that reach from the sleeves of a dead courtesan's kimono.
Ittan-momen|Japan|YOKAI|1900|A long strip of cotton cloth that flies at dusk and wraps around the faces of the unwary.
Jikininki|Japan|REVENANT|1300|Greedy priests cursed after death to devour human corpses.
Gaki|Japan|SHADE|800|Hungry ghosts with swollen bellies and needle-thin throats, never able to be satisfied.
Bake-kujira|Japan|SPECTER|1800|A skeletal ghost whale seen off Shimane, followed by strange birds and fish.
Chōchin-obake|Japan|YOKAI|1700|An old paper lantern that splits open into a mouth and lolling tongue.
Hone-onna|Japan|REVENANT|1780|A skeleton woman who keeps visiting her lover, who sees only her living face.
Akaname|Japan|POLTERGEIST|1776|A red-skinned spirit that licks the filth of neglected bathhouses.
Kerakera-onna|Japan|YOKAI|1780|A gigantic woman who laughs from the rooftops of the pleasure quarters.
Kubikajiri|Japan|REVENANT|1800|A graveyard spirit that gnaws the heads of the buried.
Futakuchi-onna|Japan|YOKAI|1700|A woman with a second, ravenous mouth hidden at the back of her head.
Ao-andon|Japan|SHADE|1776|The blue-lantern ghost that appears when the hundredth ghost story is told.
Bakeneko|Japan|YOKAI|1700|A cat that lived too long, now walking upright and wearing the faces of the dead.
Kitsune-bi|Japan|SPECTER|1700|Foxfire: floating lights in long processions said to be lit by fox spirits.
Okiku Doll|Japan|POLTERGEIST|1918|A doll at Mannenji temple whose hair is said to keep growing.
Aka Manto|Japan|POLTERGEIST|1930|A voice in the school toilet asking: red cape or blue cape? Both answers are wrong.
Hachishakusama|Japan|PHANTOM|2008|An eight-foot woman in a white hat and dress, heard as a low po-po-po.
Kashima Reiko|Japan|REVENANT|1970|A legless ghost who visits those who hear her story and asks where her legs are.
Tamamo-no-Mae|Japan|SHADE|1150|A nine-tailed fox in court disguise, sealed at last in the poisonous Killing Stone.
Jiangshi|China|REVENANT|1700|A hopping corpse in Qing official robes, halted by a paper talisman on its brow.
Nü Gui|China|WRAITH|300|A female ghost in red, wronged in life and returning for vengeance.
Diào Sǐ Guǐ|China|WRAITH|1000|The hanged ghost with a long red tongue that tempts others to the noose.
È Guǐ|China|SHADE|600|The hungry ghosts honoured during the Ghost Festival of the seventh lunar month.
Shuǐ Guǐ|China|WRAITH|1000|A drowned ghost lurking in rivers, waiting to pull a substitute under.
Wú Tóu Guǐ|China|REVENANT|1000|A headless ghost wandering in search of its lost head.
Yuān Guǐ|China|WRAITH|800|A ghost of injustice that cannot rest until its wrong is set right.
Niútóu Mǎmiàn|China|SHADE|600|Ox-Head and Horse-Face, guardians of the underworld who escort the newly dead.
Hēibái Wúcháng|China|SHADE|1000|The Black and White Impermanence, tall-hatted collectors of souls.
Nie Xiaoqian|China|PHANTOM|1740|A ghost maiden of the Liaozhai tales, enslaved by a tree demon and freed by a scholar.
Painted Skin|China|REVENANT|1740|A fiend that paints a beautiful human skin and wears it to deceive.
Mèng Pó|China|SPECTER|600|The Lady of Forgetfulness, ladling the soup that wipes memory before rebirth.
Zhōng Kuí|China|SHADE|700|A ghost who became the vanquisher of demons, painted on doors to guard homes.
Cheonyeo Gwishin|Korea|PHANTOM|1400|A maiden ghost in white hanbok with long loose hair, who died unmarried.
Mul Gwishin|Korea|WRAITH|1400|Drowned water ghosts that grab the ankles of swimmers.
Dalgyal Gwishin|Korea|SPECTER|1500|The egg ghost: a smooth, featureless face with no eyes, nose or mouth.
Dokkaebi|Korea|POLTERGEIST|1200|Horned goblin spirits with magic clubs who love wrestling and pranks.
Gumiho|Korea|YOKAI|1400|A nine-tailed fox that takes the form of a woman.
Chonggak Gwishin|Korea|PHANTOM|1400|The ghost of an unmarried young man, restless and lonely.
Janghwa and Hongryeon|Korea|PHANTOM|1656|Two murdered sisters whose ghosts appeared to each magistrate until justice was done.
Arang|Korea|WRAITH|1550|The murdered daughter of a Miryang magistrate who appeared to each new official.
Mo-sin-a|Taiwan|POLTERGEIST|1800|Little mountain spirits that lead hikers astray and feed them insects and dirt.
Little Girl in Red|Taiwan|SPECTER|1998|A girl in a red dress glimpsed in a family's hiking video, behind them on the trail.
`,
SEA: `
Krasue|Thailand|SHADE|1500|A floating woman's head trailing glowing entrails, hunting by night.
Phi Pop|Thailand|SHADE|1600|A spirit that possesses a host and devours the entrails of sleepers from within.
Phi Tai Hong|Thailand|WRAITH|1600|The ghost of a violent, sudden death, among the most dangerous of Thai spirits.
Mae Nak Phra Khanong|Thailand|PHANTOM|1850|A wife who died in childbirth yet kept house for her husband, her arm stretching to pick a fallen lime.
Phi Pret|Thailand|SHADE|1300|Towering hungry ghosts with pinhole mouths, wailing on the holy days.
Phi Am|Thailand|SPECTER|1500|A spirit that sits on the chest of sleepers, pinning them in paralysis.
Nang Tani|Thailand|PHANTOM|1700|A gentle spirit in green who dwells in wild banana trees under the full moon.
Nang Takian|Thailand|PHANTOM|1700|A woman spirit who lives in the takian tree and weeps if it is cut.
Phi Krahang|Thailand|REVENANT|1600|A man who flies at night using rice-winnowing baskets as wings.
Phi Hua Khat|Thailand|REVENANT|1800|A headless ghost carrying its head in its hands.
Phi Tai Thang Klom|Thailand|WRAITH|1700|The ghost of a mother who died pregnant, feared for her immense power.
Kuman Thong|Thailand|POLTERGEIST|1700|A golden child spirit kept in a shrine, said to bring luck and warnings.
Phi Ban Phi Ruean|Thailand|SPECTER|1500|Ancestral house spirits, honoured with offerings at miniature spirit houses.
Phi Phong|Thailand|SHADE|1600|A foul-smelling forest spirit that drinks from the mouths of sleepers.
Manananggal|Philippines|SHADE|1600|A woman who severs her upper torso and flies on bat wings, leaving her legs behind.
Aswang|Philippines|REVENANT|1500|A shapeshifting flesh-eater that hides among villagers by day.
White Lady of Balete Drive|Philippines|PHANTOM|1950|A woman in white who appears to drivers on Balete Drive in Quezon City.
Tiyanak|Philippines|POLTERGEIST|1500|A demon that imitates a crying infant to lure travellers into the forest.
Kapre|Philippines|SHADE|1500|A giant cigar-smoking spirit dwelling in old balete and acacia trees.
Tikbalang|Philippines|YOKAI|1500|A horse-headed trickster that makes travellers walk in circles.
Wakwak|Philippines|BANSHEE|1600|A night-flying creature whose wak-wak cry grows softer as it comes closer.
Santelmo|Philippines|SPECTER|1600|Floating balls of fire said to be the souls of the drowned.
Sigbin|Philippines|YOKAI|1600|A creature that walks backward with its head between its hind legs.
Mambabarang|Philippines|SHADE|1600|A witch who sends swarms of insects to curse her victims.
Pontianak|Malaysia|BANSHEE|1700|A long-haired woman in white who died in childbirth; her laugh and frangipani scent announce her.
Kuntilanak|Indonesia|BANSHEE|1700|The Indonesian sister of the pontianak, who nests in trees and laughs in the night.
Pocong|Indonesia|REVENANT|1800|A corpse in its burial shroud, hopping because its ties were never loosened.
Genderuwo|Indonesia|SHADE|1600|A hairy, ape-like spirit that haunts rocks and old trees.
Tuyul|Indonesia|POLTERGEIST|1700|A bald child spirit kept to steal money from neighbours.
Wewe Gombel|Indonesia|PHANTOM|1800|A spirit who hides neglected children until their parents learn to care.
Sundel Bolong|Indonesia|PHANTOM|1800|A beautiful woman whose long hair hides a gaping hole in her back.
Leyak|Indonesia|SHADE|1000|A Balinese witch whose flying head trails its organs through the graveyards.
Rangda|Indonesia|SHADE|1000|The Balinese demon queen of the leyak, eternal foe of the Barong.
Kuyang|Indonesia|SHADE|1700|A Borneo head-spirit that flies with its organs dangling.
Jenglot|Indonesia|REVENANT|1990|A tiny mummified humanoid with long hair and fangs, said to drink blood.
Penanggalan|Malaysia|SHADE|1600|A detached flying head with entrails, soaked in vinegar to fit back in its body.
Toyol|Malaysia|POLTERGEIST|1700|A child spirit raised by a shaman to run errands and steal.
Hantu Raya|Malaysia|SHADE|1700|A powerful familiar that can take its master's form.
Orang Minyak|Malaysia|REVENANT|1950|The Oily Man, slick and black, slipping from every grasp.
Langsuir|Malaysia|BANSHEE|1700|A flying woman with long nails and green robes who wails from the treetops.
Pelesit|Malaysia|POLTERGEIST|1700|A grasshopper familiar sent to harm on its keeper's orders.
Hantu Tinggi|Malaysia|SHADE|1800|A ghost taller than the trees that grows if you look up at it.
Hantu Kopek|Malaysia|PHANTOM|1800|A spirit that hides children who stay out after dusk.
Ma Lai|Vietnam|SHADE|1500|A head that leaves its body at night to feed.
Ap|Cambodia|SHADE|1500|A Khmer floating female head with trailing organs.
Kun Krak|Cambodia|POLTERGEIST|1600|A child spirit kept as a protective charm.
Thaye|Myanmar|REVENANT|1000|A giant ghost of a violent death, haunting the place it fell.
`,
SOUTH: `
Bhoot|India|SPECTER|0|The restless soul of one who died untimely, with backward-turned feet and no shadow.
Churel|India|BANSHEE|1000|A woman wronged in childbirth who returns with backward feet to drain young men.
Vetala|India|REVENANT|500|A spirit inhabiting corpses on cremation grounds, telling riddles to King Vikramaditya.
Pishacha|India|SHADE|-800|Flesh-eating spirits of darkness, named in the Vedas.
Brahmadaitya|India|SPECTER|1500|The ghost of a Brahmin who lives in a peepal tree, often kind to the living.
Shakchunni|India|PHANTOM|1500|The ghost of a married woman in white sari and shell bangles, who envies the living.
Mechho Bhoot|India|POLTERGEIST|1600|A Bengali ghost who steals fish from kitchens and fishermen's baskets.
Skondhokata|India|REVENANT|1700|A headless Bengali ghost, hunting for its head along the rail tracks.
Petni|India|PHANTOM|1500|The ghost of a woman who died unmarried, haunting Bengali villages.
Nishi|India|BANSHEE|1600|A night spirit that calls you by name in a loved one's voice.
Aleya|India|SPECTER|1700|Marsh lights in Bengal that mislead fishermen into drowning.
Brahmarakshas|India|SHADE|500|A learned Brahmin who misused his knowledge, reborn as a demon.
Preta|India|SHADE|-500|A hungry ghost with a tiny mouth and endless hunger.
Bhangarh Fort Spirits|India|SPECTER|1600|The ghosts of a fort cursed by a sorcerer, where entering after sunset is forbidden.
Dow Hill Headless Boy|India|SPECTER|1900|A headless boy who walks the forests of Kurseong and vanishes into the trees.
Narayanrao of Shaniwar Wada|India|BANSHEE|1773|A murdered teenage Peshwa whose cries are said to echo at the full moon.
Kuldhara Curse|India|WRAITH|1825|A village abandoned overnight, cursed so that none may settle there again.
Nale Ba|India|BANSHEE|1990|A witch who knocks with a loved one's voice; Bangalore houses wrote 'come tomorrow' on their doors.
Yakshi|India|PHANTOM|900|A Kerala spirit who seduces men with the scent of jasmine before her true face shows.
Kichkanya|Nepal|PHANTOM|1500|The ghost of a girl who died unmarried, with backward feet.
Murkatta|Nepal|REVENANT|1500|A headless ghost with eyes on its chest.
Lakhey|Nepal|YOKAI|1000|A fierce red demon who dances through Kathmandu at festival time.
Bokshi|Nepal|SHADE|1500|A witch-spirit blamed for unexplained illness.
Riri Yaka|Sri Lanka|SHADE|1500|The blood demon, most feared of the yakku, appearing near death.
Pichal Peri|Pakistan|PHANTOM|1700|A mountain spirit with backward feet who leads climbers astray.
Mamdo Bhoot|Bangladesh|SPECTER|1700|The ghost of a Muslim man in Bengali lore, said to break necks.
Yidag|Tibet|SHADE|800|A hungry ghost with a vast belly and a mouth no wider than a needle.
Ro-langs|Tibet|REVENANT|800|A corpse that stands up and walks, stiff-limbed and unable to bend.
`,
MIDEAST: `
Ghoul|Arabia|REVENANT|600|A desert fiend that haunts graveyards and lures travellers to devour them.
Ifrit|Arabia|SHADE|600|A mighty, fiery jinn of the underworld, sometimes tied to the spirits of the murdered.
Nasnas|Yemen|REVENANT|900|Half a human, hopping on one leg with half a head.
Si'lat|Arabia|PHANTOM|700|A shapeshifting jinn-woman of the wild places.
Qareen|Arabia|SPECTER|700|A spirit double that accompanies every person through life.
Al Naddaha|Egypt|BANSHEE|1900|A voice by the Nile that calls a man by name until he follows.
Lilitu|Mesopotamia|SHADE|-2000|A night spirit of the wind, haunting the desolate places.
Gidim|Mesopotamia|WRAITH|-2500|The Sumerian ghost of the dead, angered if denied offerings.
Etemmu|Mesopotamia|WRAITH|-1800|The Akkadian spirit of the dead, who returns when its burial is neglected.
Lamashtu|Mesopotamia|SHADE|-1800|A lion-headed demoness who preyed upon mothers and infants.
Al|Armenia|SHADE|1000|A spirit that harms women in childbirth and steals unborn children.
Div|Persia|SHADE|900|Monstrous demons of the Shahnameh, fought by the hero Rostam.
Ghul-e Biyaban|Persia|REVENANT|1000|The desert ghoul that leads caravans off the road.
Mazzikin|Israel|POLTERGEIST|200|Invisible harmful spirits that crowd around people.
Shedim|Israel|SHADE|-500|Storm spirits of Jewish folklore with clawed bird feet.
Ibbur|Israel|SPECTER|1600|A benevolent soul that briefly joins a living person to fulfil a duty.
Karakoncolos|Turkey|SHADE|1500|A winter goblin that calls people by name on the coldest nights.
Alkarısı|Turkey|PHANTOM|1300|A spirit with backward feet that harms new mothers.
Karabasan|Turkey|SPECTER|1500|A dark weight that sits on the chest during sleep paralysis.
Ghost of Nebusemekh|Egypt|WRAITH|-1200|An ancient Egyptian ghost who told the priest Khonsuemheb that his tomb had crumbled.
`,
AFRICA: `
Tokoloshe|South Africa|POLTERGEIST|1800|A small water sprite; beds are raised on bricks to keep it away.
Grey Lady of the Castle|South Africa|PHANTOM|1700|A weeping grey figure in the Castle of Good Hope, Cape Town.
Uniondale Hitchhiker|South Africa|PHANTOM|1968|A young woman who vanishes from the back of motorbikes near Uniondale.
Impundulu|South Africa|SHADE|1800|The lightning bird, a witch's familiar that takes the form of a man.
Asanbosam|Ghana|REVENANT|1700|A forest being that hangs from trees with iron hooks for feet.
Sasabonsam|Ghana|SHADE|1700|A tall, hairy, bat-winged forest spirit.
Adze|Togo|SHADE|1800|An Ewe spirit that travels as a firefly and drinks blood.
Obayifo|Ghana|SHADE|1700|A witch who glows with phosphorescent light as she flies.
Abiku|Nigeria|POLTERGEIST|1600|A Yoruba spirit child who dies and returns to the same mother.
Ogbanje|Nigeria|POLTERGEIST|1600|An Igbo spirit child who comes and goes between worlds.
Kishi|Angola|REVENANT|1800|A two-faced being: a handsome man before, a hyena behind.
Popobawa|Tanzania|SHADE|1965|A one-eyed bat-winged shadow that terrorised Zanzibar villages.
Eloko|Congo|SHADE|1800|Dwarf spirits of the rainforest with tiny bells and grass for hair.
Akh|Egypt|SPECTER|-2500|The transfigured spirit of the dead; an angry akh could haunt the living.
Ba|Egypt|SPECTER|-2500|The human-headed bird soul that flew out of the tomb by day.
Aisha Qandisha|Morocco|PHANTOM|1600|A jinniya with goat or camel legs who haunts riverbanks.
Kalanoro|Madagascar|POLTERGEIST|1700|A small forest being with backward feet and long nails.
Ramanga|Madagascar|SHADE|1700|A spirit that lives on the blood and nail clippings of nobles.
Yumboes|Senegal|POLTERGEIST|1800|Silver-haired Wolof spirits of the dead who feast in the hills.
Shetani|Tanzania|SHADE|1900|Twisting spirits of Makonde carvings, tricksters of the bush.
Jengu|Cameroon|PHANTOM|1700|Water spirits with long hair and gap-toothed smiles.
`,
EUROPE: `
Banshee|Ireland|BANSHEE|800|The bean sídhe, whose keening wail foretells a death in the family.
Dullahan|Ireland|REVENANT|800|A headless rider holding his own head aloft, whipping with a human spine.
Púca|Ireland|YOKAI|900|A shapeshifter, often a black horse, that carries riders on wild night journeys.
Fear Gorta|Ireland|SHADE|1600|The man of hunger, an emaciated phantom begging alms in famine times.
Leap Castle Elemental|Ireland|SHADE|1900|A sheep-sized, rotting-smelling presence in Ireland's most haunted castle.
Brown Lady of Raynham Hall|England|PHANTOM|1835|A woman in brown brocade, captured on a famous 1936 photograph on the stairs.
Anne Boleyn|England|REVENANT|1536|The beheaded queen, seen at the Tower of London carrying her head.
Black Shuck|England|SHADE|1577|A huge black hound with fiery eyes that burst into Bungay church in a storm.
Pearlin Jean|Scotland|POLTERGEIST|1600|A ghost in a lace pearlin, haunting Allanbank House with rustling silk.
Bean Nighe|Scotland|BANSHEE|800|The washer at the ford, scrubbing the grave-clothes of those about to die.
Highgate Vampire|England|REVENANT|1970|A tall dark figure reported in London's Highgate Cemetery.
Enfield Poltergeist|England|POLTERGEIST|1977|Flying furniture and a gruff voice in a North London council house.
Bloody Mary|England|SPECTER|1970|Summoned by saying her name in a darkened mirror.
Spring-heeled Jack|England|POLTERGEIST|1837|A leaping, fire-breathing figure who terrorised Victorian London.
Drummer of Tedworth|England|POLTERGEIST|1661|An invisible drum that beat through a Wiltshire house for a year.
Grey Lady of Hampton Court|England|PHANTOM|1829|The nurse Sybil Penn, seen spinning in the palace after her tomb was disturbed.
Catherine Howard|England|BANSHEE|1542|A screaming queen running down the Haunted Gallery of Hampton Court.
Roman Legion of York|England|SPECTER|1953|Soldiers seen from the knees up marching through the Treasurer's House cellar.
Annie of Mary King's Close|Scotland|SPECTER|1645|A little girl ghost in Edinburgh's buried plague street, given toys by visitors.
Green Lady|Scotland|PHANTOM|1500|A ghostly lady in green found in many Scottish castles, an omen or a guardian.
Gwrach y Rhibyn|Wales|BANSHEE|1000|The hag of the mist, flapping at windows and calling the names of the dying.
Cŵn Annwn|Wales|SHADE|1100|The white red-eared hounds of the Otherworld, hunting souls across the sky.
Will-o'-the-Wisp|England|SPECTER|1600|A flickering marsh light that leads travellers away from the safe path.
Barghest|England|SHADE|1700|A monstrous black dog of the Yorkshire dales, an omen of death.
Boggart|England|POLTERGEIST|1500|A household spirit that turns spiteful and follows a family when they move.
Old Jeffrey|England|POLTERGEIST|1716|The knocking poltergeist of Epworth Rectory, home of the Wesley family.
Borley Nun|England|PHANTOM|1863|A nun seen gliding through 'the most haunted house in England'.
Herne the Hunter|England|SHADE|1597|An antlered ghost who rides through Windsor Forest.
Draugr|Iceland|REVENANT|900|A bloated, deathly undead in its burial mound, guarding treasure with impossible strength.
Glámr|Iceland|REVENANT|1300|A shepherd's draugr of the Grettis saga, whose dying curse haunted the hero.
Myling|Sweden|BANSHEE|1600|The ghost of an unbaptised child who rides on travellers' backs demanding burial.
Mara|Norway|SPECTER|900|A spirit that rides sleepers' chests and tangles horses' manes.
Utburd|Norway|BANSHEE|1600|A wailing ghost of an abandoned infant, heard in the winter woods.
Huldra|Norway|PHANTOM|1500|A beautiful forest woman with a cow's tail and a hollow back.
Lyktgubbe|Sweden|SPECTER|1600|The lantern man, a wandering light over the bogs.
Gjenganger|Denmark|REVENANT|1600|One who walks again, returning from the grave to settle unfinished business.
Helhest|Denmark|SHADE|1600|A three-legged horse of death; whoever sees it will soon die.
Weiße Frau|Germany|PHANTOM|1486|The White Lady of the Hohenzollerns, seen before a death in the royal house.
Wild Hunt|Germany|SHADE|1000|A spectral host of riders and hounds that thunders across the winter sky.
Nachzehrer|Germany|REVENANT|1600|A corpse that chews its own shroud, draining its family from the grave.
Erlkönig|Germany|SPECTER|1782|The Elf King who whispers to a child on a night ride.
Kobold|Germany|POLTERGEIST|1400|A household spirit that works if fed, and wrecks the house if insulted.
Irrlicht|Germany|SPECTER|1500|A will-o'-wisp that dances above the moors.
Alp|Germany|SPECTER|1500|A nightmare spirit that presses on sleepers.
Bílá Paní|Czechia|PHANTOM|1539|The White Lady Perchta of Rožmberk, haunting Bohemian castles.
Rusalka|Russia|PHANTOM|1500|A drowned maiden who sings from the river and tickles men to death.
Domovoi|Russia|POLTERGEIST|1000|The bearded house spirit behind the stove, guardian and prankster.
Kikimora|Russia|POLTERGEIST|1500|A spirit that spins at night and tangles thread if the house is untidy.
Upyr|Russia|REVENANT|1047|The Slavic revenant, first named in an eleventh-century manuscript.
Bannik|Russia|POLTERGEIST|1500|The bathhouse spirit that scalds those who bathe at the wrong hour.
Vodyanoy|Russia|SHADE|1400|A bearded water spirit that drags drowned souls to its palace.
Strzyga|Poland|REVENANT|1600|A person born with two souls; one lives on after death and hunts.
Mavka|Ukraine|PHANTOM|1500|A forest maiden with no back, her organs visible from behind.
Południca|Poland|SPECTER|1500|Lady Midday, who appears in the fields at noon and asks hard riddles.
Utopiec|Poland|WRAITH|1600|A drowned spirit that pulls people under the water.
Dybbuk|Poland|WRAITH|1600|The dislocated soul of a dead person that clings to and possesses the living.
Vila|Serbia|PHANTOM|1000|Mountain spirits of the dead who dance in the moonlight.
Strigoi|Romania|REVENANT|1600|Troubled souls risen from the grave, invisible or wearing their old bodies.
Moroi|Romania|REVENANT|1600|A ghostly revenant that drains the living.
Santa Compaña|Spain|SHADE|1500|A Galician procession of the dead with candles, led by a living soul.
Lamia|Greece|SHADE|-500|A child-devouring spirit of Greek myth.
Empusa|Greece|REVENANT|-400|A shapeshifting spirit with a leg of bronze, sent by Hecate.
Lemures|Rome|WRAITH|-200|Restless Roman dead, appeased at the Lemuria by throwing beans at midnight.
Larvae|Rome|WRAITH|-100|Malevolent spirits of those who died violently.
Manes|Rome|SPECTER|-300|The honoured spirits of the Roman ancestors.
Athenodorus' Ghost|Greece|SPECTER|100|A chained old man who led the philosopher to his unburied bones, told by Pliny.
Vrykolakas|Greece|REVENANT|1600|A restless dead man who knocks on doors and calls names.
Ankou|France|SHADE|1500|The Breton collector of souls with a creaking cart and a scythe.
Dame Blanche|France|PHANTOM|1500|A white lady who waits on bridges and narrow roads.
Lavandières de Nuit|France|BANSHEE|1700|Night washerwomen who demand help wringing shrouds.
Monachicchio|Italy|POLTERGEIST|1600|A tiny ghost child in a monk's hood who hides treasure.
Azzurrina|Italy|PHANTOM|1375|A girl lost in Montebello castle whose voice is heard every solstice.
Poveglia Plague Ghosts|Italy|WRAITH|1793|Restless souls of a Venetian quarantine island.
Flying Dutchman|Netherlands|SPECTER|1795|A ghost ship doomed to sail forever, never making port.
Witte Wieven|Netherlands|PHANTOM|1500|White women of the mist around old burial mounds.
Coco|Portugal|SHADE|1500|A shapeless bogeyman who takes children who misbehave.
Black Dog of Newgate|England|SHADE|1596|A hound seen before executions at Newgate Prison.
`,
AMERICAS: `
La Llorona|Mexico|BANSHEE|1550|The weeping woman in white who walks the rivers crying for her lost children.
Resurrection Mary|USA|PHANTOM|1934|A young woman in a white dress who asks for rides to Resurrection Cemetery.
Headless Horseman|USA|REVENANT|1820|A Hessian trooper who lost his head to a cannonball, riding through Sleepy Hollow.
Bell Witch|USA|POLTERGEIST|1817|A voice that tormented the Bell family of Tennessee for years.
Lady in Black|USA|PHANTOM|1862|A woman in black who walks Fort Warren in Boston Harbor.
Greenbrier Ghost|USA|SPECTER|1897|A murdered woman whose ghost is said to have helped convict her husband.
Lincoln's Ghost|USA|SPECTER|1865|The president seen at White House windows and heard pacing the halls.
Grey Man of Pawleys Island|USA|SPECTER|1822|A figure in grey who walks the beach to warn of hurricanes.
Wendigo|Canada|SHADE|1600|An Algonquian spirit of winter starvation and insatiable greed.
Marfa Lights|USA|SPECTER|1883|Unexplained orbs that drift over the Texas desert.
Brown Mountain Lights|USA|SPECTER|1913|Ghost lights rising over a North Carolina ridge.
Hat Man|USA|SHADE|2000|A shadow figure in a brimmed hat seen during sleep paralysis.
Shadow People|USA|SHADE|1990|Human-shaped darkness glimpsed at the edges of vision.
Black-Eyed Children|USA|REVENANT|1996|Children with solid black eyes who ask to be let in.
Tommyknockers|USA|POLTERGEIST|1850|Knocking mine spirits brought by Cornish miners.
Winchester House Spirits|USA|POLTERGEIST|1886|The ghosts for whom Sarah Winchester built endless stairways to nowhere.
Eastern State Shades|USA|SHADE|1829|Shadows in the cellblocks of a Philadelphia penitentiary.
Queen Mary Ghosts|USA|SPECTER|1967|Spectral passengers aboard the retired ocean liner.
Bachelor's Grove Madonna|USA|PHANTOM|1991|A translucent woman photographed on a tombstone near Chicago.
Old Hag|Canada|SPECTER|1800|A Newfoundland spirit that sits on sleepers' chests.
Northumberland Strait Ghost Ship|Canada|SPECTER|1786|A burning three-masted ship seen sailing the strait.
Rolling Calf|Jamaica|SHADE|1700|A fire-eyed calf dragging a chain through the night roads.
Duppy|Jamaica|SPECTER|1700|The spirit of the dead that wanders if not properly settled.
Soucouyant|Trinidad|SHADE|1700|An old woman who sheds her skin and flies as a ball of fire.
Jumbie|Trinidad|POLTERGEIST|1700|A spirit of the dead in Caribbean lore.
La Diablesse|Trinidad|PHANTOM|1700|A beautiful woman with one cow's hoof hidden beneath her dress.
Lagahoo|Trinidad|REVENANT|1700|A shapeshifter dragging chains, sometimes headless.
Zombi|Haiti|REVENANT|1700|A body without a soul, raised and bound to labour.
Charro Negro|Mexico|SHADE|1800|A black-clad horseman who offers riches at a terrible price.
La Planchada|Mexico|PHANTOM|1930|A nurse in a perfectly pressed uniform who tends patients at night.
Island of the Dolls|Mexico|POLTERGEIST|1950|Hanging dolls of Xochimilco said to whisper and move.
Cihuateteo|Mexico|BANSHEE|1400|Aztec spirits of women who died in childbirth, haunting crossroads.
El Silbón|Venezuela|BANSHEE|1800|The whistler carrying a sack of bones; when his whistle is close, he is far.
La Sayona|Venezuela|PHANTOM|1800|A woman in white who punishes unfaithful men.
La Tunda|Colombia|PHANTOM|1800|A shapeshifter of the Pacific jungle who takes the form of loved ones.
La Patasola|Colombia|REVENANT|1700|A one-legged woman of the forest who lures men away.
La Luz Mala|Argentina|SPECTER|1800|The evil light of the pampas, a soul in torment.
Mula sin Cabeza|Brazil|REVENANT|1700|A headless mule breathing fire from its neck.
Saci|Brazil|POLTERGEIST|1700|A one-legged trickster in a red cap who rides in dust devils.
Corpo Seco|Brazil|REVENANT|1800|A corpse so wicked that the earth refused to rot it.
Boitatá|Brazil|SPECTER|1560|A fire serpent with burning eyes that guards the fields.
La Cegua|Costa Rica|REVENANT|1700|A beautiful hitchhiker whose face turns into a horse skull.
El Cadejo|Guatemala|SHADE|1700|Twin spectral dogs, one white and one black.
La Siguanaba|El Salvador|PHANTOM|1500|A woman washing at the river who reveals a horse face.
El Sombrerón|Guatemala|POLTERGEIST|1700|A tiny man in a huge hat who braids horses' manes.
Anchanchu|Bolivia|SHADE|1600|An Andean spirit of desolate places that brings sickness.
Caleuche|Chile|SPECTER|1700|A ghost ship of Chiloé, crewed by the drowned, glowing on the water.
`,
OCEANIA: `
Yara-ma-yha-who|Australia|REVENANT|1800|A small red being with suckers on its fingers that drops from fig trees.
Min Min Light|Australia|SPECTER|1838|A light that follows travellers across the outback of Queensland.
Fisher's Ghost|Australia|SPECTER|1826|A murdered farmer seen sitting on a fence, pointing to where his body lay.
Monte Cristo Spirits|Australia|POLTERGEIST|1880|The restless household of Australia's most haunted homestead.
Port Arthur Ghosts|Australia|WRAITH|1830|Shades of a Tasmanian penal colony.
Quarantine Station Ghosts|Australia|WRAITH|1830|Spirits of the sick in Sydney's old quarantine grounds.
Federici|Australia|PHANTOM|1888|An opera singer who collapsed on stage as Mephistopheles, still seen at the Princess Theatre.
Patupaiarehe|New Zealand|PHANTOM|1300|Pale fairy folk of the mist whose flute music enchants.
Kēhua|New Zealand|SPECTER|1300|Māori ghosts of the dead who failed to depart.
Night Marchers|Hawaii|SHADE|1200|The huaka'i pō, processions of ancient warriors with torches and drums.
Green Lady of Wahiawā|Hawaii|PHANTOM|1940|A moss-covered woman who wanders the gulch searching for her child.
Lapu|Hawaii|SPECTER|1000|Ghosts that haunt the places they knew in life.
Adaro|Solomon Islands|SHADE|1800|Sea spirits that ride waterspouts and rainbows.
Taotao Mo'na|Guam|SPECTER|1600|The ancestral spirits of the Chamorro, respected in the jungle.
Aitu|Samoa|SPECTER|1000|Spirits of the dead and of place, appeased with respect.
Teine Sā|Samoa|PHANTOM|1000|Sacred female spirits who punish disrespect, like Saumaiafe.
Masalai|Papua New Guinea|SHADE|1800|Spirits bound to particular pools, rocks and forests.
Tupilaq|Greenland|WRAITH|1800|An avenging creature made from bones and sent against an enemy.
Mihi Ghost Boat|New Zealand|SPECTER|1886|A phantom war canoe seen on Lake Tarawera before the eruption.
`,
};

const FX_BY_CLASS = {
  WRAITH: ['reverb', 'chorus', 'phaser', 'delay'],
  BANSHEE: ['delay', 'reverb', 'distort', 'chorus'],
  POLTERGEIST: ['crush', 'ring', 'delay', 'distort'],
  YOKAI: ['delay', 'chorus', 'phaser', 'tremolo'],
  REVENANT: ['distort', 'delay', 'crush', 'phaser'],
  SPECTER: ['reverb', 'delay', 'tremolo', 'ring'],
  PHANTOM: ['reverb', 'chorus', 'delay', 'tremolo'],
  SHADE: ['distort', 'crush', 'phaser', 'reverb'],
};

const FX2 = ['none', 'none', 'none', 'wah', 'comb', 'flanger', 'pingpong', 'tape'];

export const GHOSTS = [];
for (const [realm, block] of Object.entries(RAW)) {
  for (const line of block.trim().split('\n')) {
    const [name, origin, cls, year, lore] = line.split('|');
    const id = GHOSTS.length;
    const seed = hash(name + origin);
    const r = rng(seed);
    const fxList = FX_BY_CLASS[cls];
    GHOSTS.push({
      id, name, origin, cls, realm, lore,
      year: +year,
      seed,
      dread: 1 + Math.floor(r() * 5),
      wail: 1 + Math.floor(r() * 5),
      speed: 1 + Math.floor(r() * 5),
      fx: r() < 0.6 ? fxList[0] : fxList[1 + Math.floor(r() * (fxList.length - 1))],
      fx2: FX2[Math.floor(r() * FX2.length)],
      octave: Math.floor(r() * 2),
      degree: Math.floor(r() * 7),
      wiki: WIKI[name] || null,
    });
    const g = GHOSTS[GHOSTS.length - 1];
    g.traits = traitsOf(g);
  }
}

export function eraLabel(y) {
  if (y < 0) return `${-y} BCE`;
  if (y < 1000) return `${y} CE`;
  return `${y}`;
}

export function bindCost(g) { return 60 + g.dread * 40; }
