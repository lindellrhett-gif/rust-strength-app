# Politique de confidentialité

**Dernière mise à jour : 6 novembre 2026**

L’application Rust Strength est exploitée par Bluestem Software LLC (« nous »). Cette politique explique ce que nous recueillons, pourquoi, et ce que vous pouvez faire à ce sujet.

Nous avons conçu cette application pour recueillir le moins de renseignements possible. Nous ne vendons pas vos données, nous n’affichons pas de publicité et nous n’utilisons aucune trousse de développement logiciel (SDK) d’analyse ou de pistage.

## 1. Renseignements que nous recueillons

### Ce que vous nous fournissez directement

- **Adresse courriel et mot de passe.** Nécessaires pour créer un compte et vous connecter. Nous utilisons aussi votre adresse courriel pour vous envoyer un code à usage unique qui la confirme lors de votre inscription, et un autre si vous demandez à réinitialiser votre mot de passe; nous ne l’utilisons à aucune autre fin. Nous ne conservons jamais votre mot de passe sous une forme lisible : il est haché par notre fournisseur d’authentification, Supabase, et nous ne le voyons jamais.
- **Ou, si vous vous connectez avec Apple ou Google.** Au lieu d’un mot de passe, vous pouvez vous connecter avec votre compte Apple ou votre compte Google. Apple ou Google confirme qu’il s’agit bien de vous et nous transmet votre adresse courriel et un identifiant de compte, que nous conservons pour vous reconnaître la prochaine fois. Apple vous permet de masquer votre véritable adresse derrière une adresse de relais privée qui vous transfère les messages. Nous demandons à Apple votre adresse courriel seulement, pas votre nom. Google transmet aussi votre nom et un lien vers votre photo de profil; nous les supprimons tous les deux avant qu’ils soient enregistrés avec votre compte. Nous ne voyons jamais votre mot de passe Apple ou Google.
- **Nom d’utilisateur et nom affiché.** Votre compte commence avec un pseudonyme généré au hasard (par exemple `lifter_7f3a91`). Il ne contient rien à votre sujet. Vous pouvez le changer, et ce n’est qu’une fois votre propre pseudonyme choisi que les autres utilisateurs peuvent vous trouver.
- **Poids corporel (facultatif).** Sert à calculer la charge des exercices au poids du corps et des exercices assistés, comme les tractions ou un appareil à dips assisté, et à estimer les calories brûlées pendant une course enregistrée. Vous pouvez le laisser vide; les exercices assistés vous le demandent alors avant que vous les consigniez. Si vous consignez des pesées dans le journal alimentaire, la plus récente devient votre poids corporel.
- **Données d’entraînement.** Les exercices, les charges, les répétitions, la durée de maintien des exercices chronométrés comme la planche, le RPE (effort perçu), les séries, les entraînements, les préréglages, les séances planifiées, les jours de repos, ainsi que les salles d’entraînement et les appareils que vous nommez.
- **Données d’activité.** Les activités que vous consignez, comme des courses ou des sports, leur durée et, seulement si vous choisissez de les saisir, la distance, le nombre de pas et les calories brûlées.
- **Courses que vous enregistrez (facultatif).** Si vous enregistrez une course, l’application utilise la position précise de votre téléphone pendant l’enregistrement, y compris lorsque l’écran est verrouillé, pour mesurer votre distance et votre allure et pour tracer votre parcours. Nous conservons le parcours (ses points, avec l’altitude et l’heure à chacun d’eux), votre distance, votre temps en mouvement et votre temps total, vos temps intermédiaires, vos meilleurs efforts et vos calories estimées, ainsi que le titre, les notes et l’évaluation de l’effort que vous ajoutez, le cas échéant. La position n’est enregistrée qu’entre le moment où vous touchez Start et celui où vous touchez Finish (l’application est en anglais; les menus sont indiqués tels qu’ils apparaissent à l’écran). Avant que vous touchiez Start, pendant que l’écran d’enregistrement est ouvert, l’application lit aussi votre position sur votre téléphone pour afficher la qualité du signal GPS et centrer la carte; cette position n’est ni conservée ni transmise à nos serveurs. Rien n’est suivi à aucun autre moment. Vous pouvez aussi saisir une course à la main, sans aucune position.
- **Pas (facultatif).** Si vous autorisez l’accès à Mouvements et forme, l’application lit le nombre de pas à partir des capteurs de mouvement de votre iPhone. Le total de pas d’une course enregistrée est conservé avec la course. Vos nombres de pas quotidiens restent sur votre téléphone, sauf si vous activez « Share daily steps » (dans Profile, sous Sharing with friends, désactivé par défaut) : l’application téléverse alors, chaque fois que vous l’ouvrez, un total par jour pour la dernière semaine, pour le classement des pas et le trophée Steps. Si vous le désactivez, les totaux déjà téléversés sont supprimés.
- **Zones de confidentialité (facultatif).** Les lieux que vous ajoutez, comme votre domicile, sous la forme d’un point et d’une taille, pour que les cartes que vous partagez masquent le début et la fin des courses à ces endroits. Vous êtes la seule personne à pouvoir les voir.
- **Parcours sauvegardés (facultatif).** Les parcours que vous sauvegardez à partir de vos propres courses pour les refaire, avec les noms que vous leur donnez.
- **Paramètres de course.** La pause automatique, les annonces vocales, votre objectif de distance hebdomadaire, et si les nouvelles courses et leurs cartes sont partagées par défaut.
- **Trophées affichés à côté de votre nom (facultatif).** Jusqu’à deux trophées que vous choisissez d’afficher à côté de votre nom.
- **Préférences.** Les unités (lb/kg), votre plage de répétitions cible et l’équipement dont vous disposez habituellement.
- **Réactions.** Si vous réagissez à la séance d’un ami dans le fil d’actualité, nous conservons la publication à laquelle vous avez réagi et la réaction que vous avez choisie.
- **Signalements que vous faites.** Si vous signalez un autre utilisateur, nous conservons la personne que vous avez signalée, le motif et tout ce que vous écrivez.
- **Journal alimentaire (seulement avec Rust Strength Pro).** Les aliments et les boissons que vous consignez, avec la quantité, le repas, le jour et l’heure, ainsi que les calories et les nutriments correspondant à cette quantité; les aliments, les recettes et les repas sauvegardés que vous créez, y compris tout code-barres que vous ajoutez; les notes sur une journée et le fait que vous l’ayez marquée comme terminée ou non; l’eau que vous consignez; vos pesées; vos objectifs nutritionnels; et les paramètres de votre journal, comme le nom des repas, les calories ou les kilojoules, et un objectif d’eau. Lorsque vous importez une recette à partir d’un lien, nous conservons la recette que vous sauvegardez, pas le lien.
- **Les données du calculateur d’objectif (facultatif).** Votre taille, votre année de naissance, votre sexe pour l’équation (vous pouvez l’omettre), le degré d’activité de vos journées, un poids cible et la variation hebdomadaire que vous visez. Elles servent uniquement à estimer un objectif calorique et à déterminer quels objectifs vous sont proposés : les objectifs de perte de poids ne sont proposés qu’aux adultes. Vous pouvez plutôt fixer vous-même un objectif calorique, ce qui ne nécessite que votre année de naissance.
- **Votre achat (seulement si vous achetez Rust Strength Pro).** Apple encaisse le paiement; nous ne voyons jamais les détails de votre carte ni votre compte Apple. Par l’intermédiaire de notre fournisseur d’abonnements, RevenueCat, nous apprenons quel forfait vous avez acheté (mensuel, annuel ou Lifetime, c’est-à-dire à vie), quand, son prix et sa devise, les identifiants de transaction d’Apple, s’il s’agit d’un essai gratuit, s’il sera renouvelé ou s’il a été remboursé, et quand il prend fin. Nous conservons le fait que vous avez Pro ou non, le forfait, et la date de son renouvellement ou de sa fin, pour débloquer les fonctionnalités de Pro.

### Ce qui est créé automatiquement

- **Horodatages.** Le début et la fin des entraînements et des activités, pour que l’application puisse afficher les durées, les séquences de jours d’entraînement et l’historique.
- **Un identifiant de compte aléatoire.** Sert à associer vos données à votre compte.
- **Une trace de votre acceptation.** Lorsque vous acceptez les Conditions d’utilisation et la Politique de confidentialité, consentez à notre utilisation de vos renseignements sur la santé (section 2) et confirmez votre âge, nous conservons la version que vous avez acceptée et la date de votre acceptation. Nous conservons le fait que vous avez confirmé votre âge, jamais votre date de naissance. (Le calculateur d’objectif du journal alimentaire demande une année de naissance, comme décrit ci-dessus.)
- **Journaux de serveur.** Notre hébergeur enregistre des renseignements techniques courants, y compris les adresses IP, pour faire fonctionner et sécuriser le service.

### Ce que nous ne recueillons PAS

Nous ne recueillons pas votre vrai nom, votre numéro de téléphone, vos photos, vos vidéos, vos contacts, les données de votre microphone ou de votre appareil photo, vos identifiants publicitaires, vos données biométriques, vos identifiants gouvernementaux ni vos renseignements de paiement. Nous ne recueillons votre position que pendant que vous enregistrez une course, comme décrit ci-dessus.

L’application peut demander cinq autorisations d’appareil, chacune seulement lorsque vous utilisez la fonctionnalité qui en a besoin, et chacune peut être désactivée à tout moment dans les réglages de votre téléphone :

- **Notifications**, seulement si vous activez « Alert when rest is over » dans votre profil. Cette alerte est programmée sur votre téléphone, par votre téléphone. Aucun jeton de notification poussée (push) ni identifiant d’appareil n’est créé, et rien à ce sujet ne nous est transmis.
- **Localisation**, « Lorsque l’app est active », lorsque vous commencez à enregistrer une course, ou si vous choisissez de placer une zone de confidentialité à l’endroit où vous vous trouvez. L’application ne demande jamais « Toujours ».
- **Mouvements et forme**, lorsque vous commencez une course, choisissez d’afficher les pas du jour ou activez Share daily steps.
- **Photos, ajout seulement**, la première fois que vous touchez Save to Photos sur une carte de partage (voir la section 4). L’application peut ajouter la carte à votre photothèque; elle ne peut ni voir, ni lire, ni téléverser aucune de vos photos.
- **Appareil photo**, la première fois que vous ouvrez le lecteur de codes-barres dans le journal alimentaire. Le code-barres est lu sur votre téléphone. L’image captée par l’appareil photo n’est ni enregistrée, ni conservée, ni envoyée nulle part; seul le numéro du code-barres est utilisé, pour rechercher l’aliment (voir la section 5). Vous pouvez plutôt saisir un code-barres.

Pendant l’enregistrement d’une course, et pendant que la minuterie de repos s’écoule entre les séries, l’application affiche ces renseignements sur l’écran verrouillé et dans la Dynamic Island (le temps, la distance et l’allure d’une course; le repos restant et votre prochaine série), où toute personne qui tient votre téléphone peut les voir. Cela ne nécessite aucune autorisation, se fait sur votre téléphone, et rien à ce sujet ne nous est transmis. Vous pouvez désactiver cet affichage sous Activités en direct dans les réglages de votre téléphone pour l’application.

## 2. Renseignements sur la santé et la condition physique

Les données d’entraînement, le poids corporel, les calories brûlées, le nombre de pas et tout le contenu du journal alimentaire (ce que vous mangez et buvez, les pesées, les objectifs nutritionnels et les données du calculateur d’objectif) sont des **renseignements liés à la santé**. Certaines lois d’États américains, dont la My Health My Data Act de l’État de Washington (loi sur les données de santé des consommateurs), considèrent cette catégorie comme particulièrement sensible. Notre Consumer Health Data Privacy Policy (en anglais) expose, dans un document distinct, quelles données de santé nous recueillons, d’où elles proviennent, qui les reçoit et comment exercer vos droits : https://lindellrhett-gif.github.io/rust-strength/health-data.html Les parcours des courses que vous enregistrez sont des renseignements de localisation précis et peuvent révéler où vous habitez ou passez votre temps. Vous êtes la seule personne à pouvoir voir le parcours complet d’une course. Vos amis ne voient un tracé écourté que si vous choisissez de partager la carte d’une course (voir la section 4).

Nous les utilisons uniquement pour faire fonctionner les fonctionnalités que vous voyez : afficher votre historique, estimer votre charge maximale sur une répétition, suggérer votre prochaine charge, enregistrer vos courses, calculer vos statistiques et vos trophées, et tenir votre journal alimentaire, ses totaux, ses objectifs et ses rapports.

**Nous demandons d’abord votre consentement.** Avant que vous puissiez utiliser l’application, nous vous demandons d’accepter, séparément des Conditions d’utilisation, que nous utilisions vos renseignements sur la santé comme le décrit cette politique. Enregistrer votre entraînement et votre santé est la raison d’être de l’application; elle ne peut donc pas fonctionner sans ce consentement. Vous pouvez le retirer à tout moment en supprimant les renseignements ou votre compte (section 8). Retirer votre consentement ne change rien à ce que nous avons fait auparavant.

**Votre journal alimentaire est privé.** Rien de son contenu n’est montré à vos amis, dans le fil, au classement ni sur les cartes de partage. Le seul lien avec le reste de l’application est que votre pesée la plus récente devient votre poids corporel, qui reste privé lui aussi.

**Nous ne les vendons pas, ne les partageons pas à des fins publicitaires et ne les utilisons à aucune autre fin que le fonctionnement de l’application.** Ils ne sont visibles par une autre personne que là où vous avez choisi de les partager (voir la section 4).

## 3. Utilisation des renseignements

- Pour créer et sécuriser votre compte
- Pour conserver et afficher votre historique d’entraînement
- Pour calculer votre charge maximale estimée sur une répétition et suggérer des charges
- Pour calculer les statistiques, les séquences, les trophées et le schéma corporel hebdomadaire
- Pour enregistrer les courses et afficher vos parcours, temps intermédiaires, records et historique de course, pour annoncer à voix haute votre distance et votre allure pendant une course, et pour compter vos pas
- Pour tenir votre journal alimentaire : rechercher des aliments, additionner les calories et les nutriments, estimer un objectif calorique, et afficher vos rapports et l’évolution de votre poids
- Pour faire fonctionner la fonctionnalité d’amis à laquelle vous choisissez de participer, y compris le fil et les réactions
- Pour calculer vos XP (points d’expérience), votre niveau et vos badges à partir des totaux ci-dessus
- Pour examiner les signalements d’abus
- Pour assurer le fonctionnement et la sécurité du service

Nous n’utilisons pas vos renseignements à des fins publicitaires, et nous ne prenons à votre sujet aucune décision automatisée produisant des effets juridiques ou des effets similaires importants. L’application calcule certaines choses à partir de ce que vous enregistrez, comme les suggestions de charge, un objectif calorique, votre niveau et vos trophées, uniquement pour vous les montrer, et vous êtes libre de ne pas en tenir compte.

## 4. Ce que les autres peuvent voir

Les fonctionnalités sociales sont **à adhésion volontaire**. Tant que vous n’avez pas choisi de nom d’utilisateur et ajouté un ami, personne ne peut rien voir.

- **Toute personne connectée** peut rechercher des noms d’utilisateur et des noms affichés, mais seulement pour les comptes qui ont choisi leur propre pseudonyme. Rien d’autre n’est visible.
- **Les amis acceptés** peuvent voir votre nom d’utilisateur, votre nom affiché, vos trophées, vos badges, votre niveau, votre séquence, votre régularité, votre nombre total d’entraînements, votre volume total, votre nombre total de répétitions et de séries, votre temps total d’entraînement, vos totaux d’activité, la distance totale que vous avez courue, votre nombre d’amis, le nombre de réactions reçues par vos publications, les trophées que vous avez choisi d’afficher à côté de votre nom, vos totaux de pas quotidiens si vous les partagez, vos records personnels par exercice (pour les exercices au poids du corps ou assistés, seulement vos répétitions : ils s’affichent « BW », jamais un poids), les dates de vos entraînements, et si vous consignez en livres ou en kilogrammes (pour que les totaux puissent être comparés équitablement).
- **Le classement** vous classe, vous et vos amis acceptés, selon la séquence en cours, le poids total soulevé, le temps d’entraînement, la régularité, le temps d’activité, la distance courue et, pour les personnes qui les partagent, les pas quotidiens. Il n’utilise que les chiffres énumérés ci-dessus, et n’y figurent que vous et vos amis acceptés.
- **Les amis acceptés voient aussi un résumé de chaque séance dans le fil et sur votre profil** (voir ci-dessous).
- **Personne** ne peut voir votre adresse courriel, votre poids corporel, vos notes, vos séances planifiées, vos jours de repos, vos zones de confidentialité, vos parcours sauvegardés, vos nombres de pas (sauf si vous partagez vos pas quotidiens), le parcours complet d’une course, les séries individuelles d’un entraînement ni quoi que ce soit dans votre journal alimentaire. Les jours de repos que vous marquez maintiennent bien votre séquence et comptent dans votre régularité, de sorte que ces deux chiffres en tiennent compte, mais les jours eux-mêmes ne sont jamais montrés à personne.

### Le fil des amis

**Le partage est désactivé au départ.** Les nouveaux comptes ne publient rien dans le fil. Lorsque vous acceptez votre premier ami, l’application vous demande une seule fois si vous voulez partager vos séances avec vos amis, et vous pouvez changer votre réponse à tout moment dans Profile, sous « Sharing with friends ».

Tant que le partage est activé, un résumé de chaque entraînement que vous terminez ou de chaque activité que vous consignez, y compris ceux qui précèdent l’activation du partage, apparaît dans le fil des amis que vous avez acceptés, et sur votre profil, où ils peuvent le consulter plus tard. Un résumé comprend :

- le nom de la séance ou de l’activité, et le moment où elle a eu lieu
- sa durée
- le poids total déplacé, les séries et les répétitions
- les exercices effectués, par leur nom
- le nombre de records personnels établis
- pour une activité, sa distance si vous en avez enregistré une, et pour une course, son allure

**Les séries individuelles ne sont jamais partagées** : ni la charge, ni les répétitions, ni le RPE d’une série, ni vos notes.

### Les courses dans le fil

Chaque course a ses propres interrupteurs de partage, et l’écran Running settings fixe la valeur par défaut pour les nouvelles courses :

- **Share to friends’ feed.** Activé par défaut pour chaque course, mais aucune course n’arrive dans le fil tant que « Show my sessions in the feed » est désactivé. Si vous le désactivez pour une course, cette course n’est visible que par vous.
- **Show the map to friends.** Vous faites ce choix sur l’écran d’enregistrement pour chaque course, et il est **désactivé** au départ, sauf si vous changez la valeur par défaut dans Running settings. Lorsqu’il est désactivé, vos amis voient votre distance, votre temps et votre allure, mais pas l’endroit où vous avez couru. Vous voyez toujours le tracé de vos propres courses. Si vous l’activez, vos amis voient un tracé simplifié du parcours, dont les 200 premiers et les 200 derniers mètres sont toujours retirés, de même que toute partie du départ ou de l’arrivée située dans l’une de vos zones de confidentialité. Ce retrait se fait sur notre serveur, de sorte que le parcours complet n’atteint jamais le téléphone de qui que ce soit d’autre. Un parcours qui traverse une zone de confidentialité en son milieu y est quand même affiché : les zones masquent l’endroit où une course commence et se termine, pas l’endroit où elle passe.

Vos amis peuvent réagir à une publication. Vous voyez combien de réactions de chaque type une publication a reçues, mais **pas qui les a laissées**.

**Vous pouvez désactiver ceci.** Dans Profile, sous « Sharing with friends », désactivez « Show my sessions in the feed » et vos séances cessent immédiatement d’apparaître pour tout le monde, dans le fil et sur votre profil. Les autres fonctionnalités d’amis continuent de fonctionner.

Vous pouvez retirer un ami ou bloquer quelqu’un à tout moment. Le blocage supprime toute amitié existante et vous cache l’un à l’autre dans la recherche.

### Cartes de partage

Après un entraînement ou une course, vous pouvez créer une carte-image à partager, par exemple sur Instagram, dans Messages ou dans vos Photos. **La carte est créée sur votre téléphone et rien à son sujet ne nous est transmis.** Elle n’est partagée que si vous touchez Share ou Save to Photos, et seulement avec l’application ou la personne que vous choisissez. Une fois que vous l’avez partagée, ce qu’il en advient dépend de vous et du service auquel vous l’avez envoyée, selon les conditions propres à ce service.

- Une **carte d’entraînement** affiche le nom de la séance, sa date et sa durée, le poids total soulevé, les séries, les répétitions, le nombre d’exercices, vos records personnels, les groupes musculaires sollicités, ainsi que le nombre de séries et la meilleure série de chaque exercice.
- Une **carte de course** affiche le nom de la course, sa date, sa distance, son temps, son allure, son dénivelé positif, ses temps intermédiaires et ses meilleurs efforts. Si vous activez « Show the route » (désactivé au départ), elle affiche aussi la forme du parcours, sans fond de carte, écourtée au moins autant que pour les amis (les 200 premiers et les 200 derniers mètres, ainsi que toute partie du départ ou de l’arrivée située dans vos zones de confidentialité, sont retirés). Ce retrait se fait sur votre téléphone avant la création de l’image.

## 5. Avec qui nous partageons des renseignements

Nous ne vendons pas vos renseignements personnels et nous ne les partageons pas à des fins de publicité comportementale intercontextuelle (cross-context behavioral advertising).

Nous faisons appel aux fournisseurs de services suivants :

| Fournisseur | Ce qu’il fait | Ce qu’il reçoit |
|---|---|---|
| Supabase | Base de données, authentification et hébergement | Vos identifiants de connexion et toutes les données de l’application décrites ci-dessus |
| Google (Gmail) | Envoie les codes de confirmation de votre adresse courriel et de réinitialisation de votre mot de passe, et héberge notre boîte de soutien | Votre adresse courriel et le code à usage unique, lorsque vous vous inscrivez ou demandez à réinitialiser votre mot de passe; et tout courriel que vous nous envoyez |
| Apple (« Se connecter avec Apple ») | Vous connecte, si vous choisissez cette option | Apple confirme votre compte Apple et nous transmet votre adresse courriel (ou votre adresse de relais privée) et un identifiant de compte. Lorsque vous supprimez votre compte, nous demandons à Apple de mettre fin à l’accès de l’application à votre compte Apple |
| Google (« Se connecter avec Google ») | Vous connecte, si vous choisissez cette option | Google confirme votre compte Google et nous transmet votre adresse courriel et un identifiant de compte, ainsi que votre nom et le lien vers votre photo de profil, que nous supprimons |
| Apple (Plans) | Affiche les cartes dans l’application | Les demandes de carte de la zone affichée à l’écran, qui, comme toute connexion, comprennent votre adresse IP. Pas votre compte, ni vos parcours, qui sont tracés sur votre téléphone |
| Open Food Facts, une base de données alimentaire sans but lucratif | Recherche les aliments emballés pour le journal alimentaire | Lorsque vous lisez ou saisissez un code-barres, ou recherchez un aliment emballé : le code-barres ou les mots recherchés, envoyés directement depuis votre téléphone. Comme toute connexion, cela comprend votre adresse IP. La demande nomme l’application, pas vous. Pas votre compte, votre journal ni quoi que ce soit d’autre que vous avez consigné |
| RevenueCat | Fait fonctionner Rust Strength Pro : affiche les forfaits, vérifie les achats auprès d’Apple, indique à l’application si vous avez Pro, et fournit l’écran qui permet de gérer votre forfait et d’obtenir de l’aide pour un achat | Votre identifiant de compte aléatoire, les détails d’achat décrits à la section 1, les renseignements techniques sur l’application et votre appareil nécessaires au traitement des achats (comme la version de l’application, le système d’exploitation, ainsi que le pays et la devise de votre compte App Store), et tout ce que vous choisissez de répondre dans son écran d’aide à l’achat, par exemple la raison de votre annulation. Pas votre entraînement, vos courses ni aucune autre donnée de l’application. L’application associe votre compte à RevenueCat lorsque vous vous connectez, pour que RevenueCat puisse déterminer si vous avez Pro |

Supabase, Google et RevenueCat traitent ces renseignements pour notre compte, selon leurs propres conditions de sécurité et de confidentialité; Apple traite les demandes de carte, les paiements et « Se connecter avec Apple » selon la politique de confidentialité d’Apple; Google traite « Se connecter avec Google » selon la politique de confidentialité de Google; Open Food Facts traite les recherches selon ses propres conditions. Nous pouvons aussi communiquer des renseignements si la loi l’exige, ou pour enquêter sur un abus ou protéger la sécurité d’une personne.

**Sites de recettes.** Si vous importez une recette à partir d’un lien, votre téléphone charge lui-même cette page, comme le ferait un navigateur, de sorte que le site Web que vous avez choisi reçoit la demande et votre adresse IP. Le lien ne nous est pas transmis.

**Données alimentaires que nous détenons.** Le catalogue des aliments courants provient de USDA FoodData Central et est stocké sur nos serveurs, de sorte qu’une recherche dans ce catalogue n’envoie rien à l’USDA. Les recherches sont envoyées à notre base de données pour trouver les aliments correspondants et ne sont pas enregistrées avec votre compte.

Nous n’utilisons **aucun** service de publicité, de signalement de plantages ou de pistage, ni aucun outil d’analyse autre que les chiffres d’abonnement que RevenueCat nous présente, comme le nombre de personnes qui s’abonnent ou qui annulent.

## 6. Lieu de stockage des renseignements

**Sur les serveurs de notre fournisseur.** Sur l’infrastructure hébergée de Supabase, aux États-Unis. Les données sont transmises par des connexions chiffrées (HTTPS/TLS) et l’accès est restreint au niveau de la base de données de sorte que, par défaut, vous ne pouvez lire et écrire que vos propres lignes de données.

**Sur votre propre téléphone.** Pour que l’application continue de fonctionner dans une salle d’entraînement sans signal, une copie de votre entraînement récent et de votre journal alimentaire est conservée sur votre appareil, ainsi que tout ce que vous consignez hors ligne et qui n’a pas encore atteint le serveur. Une course en cours d’enregistrement, y compris ses points de localisation, est conservée sur votre téléphone jusqu’à ce que vous la sauvegardiez ou l’abandonniez, pour qu’elle ne soit pas perdue si l’application se ferme. Cette copie se trouve dans le stockage privé de l’application, que le système d’exploitation garde séparé des autres applications et protège par le code d’accès de votre appareil. Elle est supprimée lorsque vous vous déconnectez, lorsque vous supprimez votre compte et lorsque vous supprimez l’application.

## 7. Durée de conservation

Nous conservons vos données tant que votre compte existe. Lorsque vous supprimez votre compte, vos données sont supprimées immédiatement et définitivement (voir la section 8). La copie hors ligne sur votre téléphone est effacée en même temps, et la suppression de l’application l’efface aussi. Les copies de sauvegarde et les journaux de serveur détenus par notre fournisseur peuvent subsister pendant une courte période par la suite, selon le calendrier de conservation de ce fournisseur.

## 8. Suppression de votre compte et de vos données

Vous pouvez supprimer votre compte depuis l’application : **Profile → Privacy & legal → Delete account**.

Cela supprime définitivement votre compte, votre profil, vos entraînements, vos séries, vos activités, vos courses et leurs parcours, vos meilleurs efforts, vos zones de confidentialité, vos parcours sauvegardés, vos paramètres de course, vos totaux de pas quotidiens, vos jours de repos, vos préréglages, vos séances planifiées, vos salles d’entraînement, vos appareils, vos exercices personnalisés, vos amitiés, vos blocages, vos badges, les réactions que vous avez laissées, les signalements que vous avez faits, votre journal alimentaire (entrées, aliments, recettes, repas sauvegardés, notes de journée, eau, pesées, objectifs nutritionnels et paramètres) et notre dossier sur votre abonnement. La suppression d’un entraînement ou d’une activité supprime aussi les réactions que d’autres personnes y ont laissées. Nous demandons aussi à RevenueCat de supprimer son dossier vous concernant et, si vous utilisez « Se connecter avec Apple », nous demandons à Apple de mettre fin à l’accès de l’application à votre compte Apple (Apple vous demande d’abord de confirmer une dernière fois). Apple conserve son propre dossier de vos achats selon sa politique de confidentialité. **Cette suppression est irréversible et nous ne pouvons pas restaurer vos données.**

**Supprimer votre compte n’annule pas un abonnement Rust Strength Pro.** Annulez-le d’abord dans les réglages de votre appareil (Réglages > votre nom > Abonnements), sinon Apple continuera de vous facturer.

Vous pouvez aussi télécharger d’abord tout ce que nous détenons à votre sujet : **Profile → Privacy & legal → Download my data**.

Si vous ne pouvez pas accéder à l’application, écrivez à ruststrengthsupport@gmail.com à partir de l’adresse courriel de votre compte et nous traiterons votre demande.

## 9. Vos droits en matière de vie privée

Selon l’endroit où vous habitez, vous pouvez avoir le droit de savoir ce que nous recueillons, d’en obtenir une copie, de le corriger, de le supprimer et de ne pas subir de discrimination pour avoir exercé ces droits. Les résidents de la Californie ont ces droits en vertu de la CCPA/CPRA (lois californiennes sur la protection de la vie privée des consommateurs).

**Nous ne vendons ni ne partageons de renseignements personnels**, il n’y a donc aucune option de retrait à exercer.

Les outils d’exportation et de suppression intégrés à l’application répondent immédiatement aux demandes d’accès et de suppression. Pour toute autre demande, communiquez avec nous à ruststrengthsupport@gmail.com. Nous ne vous traiterons pas différemment parce que vous avez fait une demande.

## 10. Enfants

L’application Rust Strength n’est pas destinée aux enfants de moins de 13 ans, de moins de 14 ans au Canada, ou de moins de 16 ans dans l’Union européenne, en Islande, au Liechtenstein et en Norvège. Vous devez confirmer que vous avez l’âge requis pour créer un compte ou, si vous vous connectez avec Apple ou Google, avant de pouvoir utiliser l’application. L’application demande l’âge le plus élevé lorsque la région de votre téléphone est réglée sur l’un de ces pays. Nous ne recueillons pas sciemment de renseignements auprès d’enfants qui n’ont pas atteint ces âges. Si vous croyez qu’un tel enfant a créé un compte, écrivez à ruststrengthsupport@gmail.com et nous le supprimerons.

## 11. Sécurité

Les mots de passe sont hachés par notre fournisseur d’authentification et ne sont jamais conservés sous une forme lisible. Tout le trafic utilise HTTPS/TLS. L’accès à la base de données est restreint à chaque utilisateur par la sécurité au niveau des lignes. Votre session, la copie hors ligne de votre entraînement et toute course en cours décrites à la section 6 sont conservées dans le stockage privé de l’application sur votre propre appareil et sont effacées lorsque vous vous déconnectez.

Aucun système n’est parfaitement sûr, et nous ne pouvons pas garantir une sécurité absolue.

## 12. Modifications

Si nous modifions cette politique de façon importante, nous mettrons à jour la date ci-dessus et vous demanderons d’accepter la nouvelle version dans l’application.

## 13. Si vous habitez à l’extérieur des États-Unis

Tout ce qui précède s’applique où que vous habitiez. Cette section ajoute ce que la loi de certains autres pays nous demande de vous dire.

**Vos renseignements sont stockés aux États-Unis.** Supabase les y conserve pour nous (section 6), et les fournisseurs de la section 5 sont des entreprises américaines. Le droit américain peut protéger vos renseignements moins bien que le droit de l’endroit où vous habitez. Nous leur appliquons cette politique, où qu’ils se trouvent.

### Nouvelle-Zélande

Nous traitons vos renseignements conformément à la Privacy Act 2020 (loi néo-zélandaise de 2020 sur la protection des renseignements personnels).

- **Qui les recueille et les détient :** Bluestem Software LLC, 308 6th St W, Park River, ND 58270. Supabase les stocke pour notre compte.
- **Ce que nous recueillons, pourquoi, et qui y a accès :** sections 1 à 5. Votre adresse courriel est nécessaire pour créer un compte. Tout le reste est facultatif; ne pas le fournir signifie seulement que la fonctionnalité qui l’utilise ne fonctionne pas.
- **Accès et correction :** vous pouvez consulter et télécharger vos renseignements à tout moment (**Profile → Privacy & legal → Download my data**) et en modifier la plupart dans l’application. Pour toute autre demande, ou pour faire corriger quelque chose, écrivez à ruststrengthsupport@gmail.com. Nous répondrons dans un délai de 20 jours ouvrables.
- **Plaintes :** écrivez-nous d’abord. Si la réponse ne vous satisfait pas, vous pouvez porter plainte auprès du Privacy Commissioner (commissaire néo-zélandais à la protection de la vie privée) : https://www.privacy.org.nz
- **Atteintes :** si une atteinte à la vie privée est susceptible de vous causer un préjudice grave, nous vous en informerons, de même que le Privacy Commissioner, dès que possible.

### Australie

Nous traitons vos renseignements conformément aux Australian Privacy Principles (principes australiens de protection de la vie privée) de la Privacy Act 1988 (loi australienne de 1988 sur la protection de la vie privée).

- **Qui nous sommes :** Bluestem Software LLC, 308 6th St W, Park River, ND 58270, ruststrengthsupport@gmail.com.
- **Les renseignements sur la santé** (section 2) sont des renseignements sensibles. Nous ne les recueillons qu’avec votre consentement, que vous donnez en les saisissant, et nous ne les utilisons que pour les fonctionnalités qui en ont besoin. Vous pouvez retirer votre consentement en supprimant ces renseignements ou votre compte (section 8).
- **Vous n’avez pas à donner votre vrai nom.** Votre compte commence avec un pseudonyme aléatoire, et l’application ne demande jamais votre nom.
- **À l’étranger :** vos renseignements sont stockés et traités aux États-Unis (voir ci-dessus).
- **Accès et correction :** comme pour la Nouvelle-Zélande ci-dessus. Nous répondrons dans un délai de 30 jours.
- **Plaintes :** écrivez-nous et nous vous répondrons dans un délai de 30 jours. Si la réponse ne vous satisfait pas, vous pouvez porter plainte auprès de l’Office of the Australian Information Commissioner (commissariat australien à l’information) : https://www.oaic.gov.au
- **Atteintes :** si une atteinte aux données est susceptible de vous causer un préjudice grave, nous vous en informerons, de même que le commissaire.

### Canada

Nous traitons vos renseignements conformément à la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE) et, si vous habitez au Québec, à la Loi sur la protection des renseignements personnels dans le secteur privé.

- **Personne responsable :** notre responsable de la protection des renseignements personnels (Privacy Officer), Bluestem Software LLC, 308 6th St W, Park River, ND 58270, ruststrengthsupport@gmail.com. Cette personne veille à la protection de vos renseignements personnels et répond à vos questions et à vos demandes.
- **Consentement :** nous utilisons vos renseignements uniquement aux fins décrites aux sections 2 et 3. Vous donnez un consentement exprès à notre utilisation de vos renseignements sur la santé avant de pouvoir utiliser l’application (section 2). Vous pouvez retirer votre consentement à tout moment en supprimant les renseignements ou votre compte; les fonctionnalités qui les utilisent cessent alors de fonctionner.
- **Confidentialité par défaut :** les nouveaux comptes commencent avec le partage avec les amis désactivé, et rien de ce que vous consignez n’est montré à qui que ce soit tant que vous ne choisissez pas de le partager (section 4).
- **Hors du Québec et du Canada :** vos renseignements sont stockés aux États-Unis (voir ci-dessus). Avant de communiquer à l’extérieur du Québec les renseignements des résidents du Québec, nous avons évalué la protection dont ils y bénéficient.
- **Vos droits :** vous pouvez demander quels renseignements nous détenons et comment nous les utilisons, y accéder et les faire rectifier, et retirer votre consentement. Au Québec, vous pouvez aussi obtenir vos renseignements dans un format technologique structuré et couramment utilisé, ce que fournit **Download my data**. Nous répondrons dans un délai de 30 jours.
- **Plaintes :** écrivez-nous d’abord. Vous pouvez aussi porter plainte auprès du Commissariat à la protection de la vie privée du Canada (https://www.priv.gc.ca) ou, au Québec, de la Commission d’accès à l’information (https://www.cai.gouv.qc.ca).
- **Âge :** vous devez avoir au moins 14 ans pour utiliser l’application au Canada, parce que la loi du Québec exige le consentement d’un parent pour recueillir des renseignements auprès d’un enfant de moins de 14 ans.
- **Atteintes :** si une atteinte crée un risque réel de préjudice grave pour vous (ou, au Québec, un risque de préjudice sérieux), nous vous en informerons, de même que le commissaire ou la Commission.
- **En français :** cette politique et les Conditions d’utilisation existent en français et en anglais, et les deux versions font également foi. La version anglaise se trouve à https://lindellrhett-gif.github.io/rust-strength/privacy.html et à https://lindellrhett-gif.github.io/rust-strength/terms.html, ainsi que dans l’application sous **Profile → Privacy & legal**.

### Royaume-Uni, Union européenne, Islande, Liechtenstein et Norvège

Nous traitons vos renseignements conformément au RGPD du Royaume-Uni (UK GDPR) et au Règlement général sur la protection des données (RGPD) de l’Union européenne.

- **Responsable du traitement :** Bluestem Software LLC, 308 6th St W, Park River, ND 58270, ruststrengthsupport@gmail.com.
- **Notre représentant au Royaume-Uni :** sera nommé ici avant que Rust Strength soit offert au Royaume-Uni.
- **Notre représentant dans l’Union européenne :** sera nommé ici avant que Rust Strength soit offert dans l’Union européenne.

Vous pouvez communiquer avec un représentant plutôt qu’avec nous pour toute question concernant vos renseignements.

**Pourquoi nous utilisons vos renseignements (nos bases juridiques) :**

| Ce que nous faisons | Base juridique |
|---|---|
| Créer votre compte et faire fonctionner les fonctionnalités que vous utilisez (sections 1 et 3), y compris Pro si vous l’achetez | C’est nécessaire pour vous fournir l’application pour laquelle vous avez créé un compte (contrat, article 6, paragraphe 1, point b)) |
| Utiliser vos renseignements sur la santé (section 2), y compris montrer des résumés de séances à vos amis si vous activez le partage | Votre consentement explicite (article 9, paragraphe 2, point a)) |
| Assurer la sécurité du service, prévenir les abus et examiner les signalements | Notre intérêt légitime à assurer la sécurité de l’application et des personnes qui l’utilisent (article 6, paragraphe 1, point f)) |
| Tenir les registres exigés par la loi et répondre aux demandes licites des autorités | Obligation légale (article 6, paragraphe 1, point c)) |

- **Vos droits :** vous pouvez demander une copie de vos renseignements, les faire rectifier ou effacer, limiter l’utilisation que nous en faisons, les recevoir dans un format lisible par machine (**Download my data**) et vous opposer à ce que nous faisons sur la base de nos intérêts légitimes. Vous pouvez retirer votre consentement à tout moment, comme le décrit la section 2. Nous répondrons dans un délai d’un mois; si une demande est complexe, nous pourrons prendre jusqu’à deux mois de plus, et nous vous en informerons le cas échéant.
- **Plaintes :** communiquez d’abord avec nous ou avec notre représentant, si possible. Vous pouvez aussi porter plainte auprès d’une autorité de protection des données : au Royaume-Uni, l’Information Commissioner’s Office (https://ico.org.uk); dans l’Union européenne, en Islande, au Liechtenstein et en Norvège, l’autorité du lieu où vous habitez (liste à https://www.edpb.europa.eu/about-edpb/about-edpb/members_en).
- **Transferts vers les États-Unis :** l’entente de traitement des données de Supabase comprend les clauses contractuelles types de la Commission européenne et l’addenda du Royaume-Uni (UK Addendum) à ces clauses, qui établissent les protections dont vos renseignements continuent de bénéficier pendant qu’ils sont conservés aux États-Unis. Écrivez-nous pour en obtenir une copie. Les autres fournisseurs de la section 5 reçoivent beaucoup moins de renseignements, selon leurs propres conditions.
- **Décisions automatisées :** nous n’en prenons aucune qui produise des effets juridiques à votre égard ou qui vous affecte de manière significative de façon similaire. Les suggestions de charge et les objectifs caloriques sont des calculs que vous êtes libre d’ignorer.
- **Ce que vous devez nous fournir :** une adresse courriel, pour créer un compte, et les renseignements sur la santé que l’application enregistre, puisque leur enregistrement est la raison d’être de l’application. Tout le reste est facultatif.
- **Enfants :** vous devez avoir au moins 16 ans dans l’Union européenne, en Islande, au Liechtenstein et en Norvège, et au moins 13 ans au Royaume-Uni. Les nouveaux comptes commencent avec le partage désactivé.

## 14. Nous joindre

Bluestem Software LLC
308 6th St W, Park River, ND 58270
ruststrengthsupport@gmail.com

Vous pouvez joindre notre responsable de la protection des renseignements personnels (Privacy Officer) à la même adresse.
