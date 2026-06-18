export type ExtraCurricularActivityGroup = {
  id: string;
  title: string;
  description: string;
};

export type ExtraCurricularActivity = {
  id: string;
  groupId: string;
  title: string;
  teachers: string[];
  note?: string;
  positionCodes?: string[];
  visible?: boolean;
};

export const EXTRA_CURRICULAR_SOURCE_FILE =
  "EXTRA AND CO-CURRICULAR ACTIVITIES TEACHER IN CHARGE2025.docx";
export const EXTRA_CURRICULAR_SOURCE_TITLE = "EXTRA AND CO-CURRICULAR ACTIVITIES - 2026";

export const EXTRA_CURRICULAR_GROUPS: ExtraCurricularActivityGroup[] = [
  {
    id: "clubs-and-societies",
    title: "Clubs & Societies",
    description:
      "Student-led spaces for communication, creativity, service, teamwork, and leadership across the college.",
  },
  {
    id: "leadership-and-service",
    title: "Leadership & Student Service",
    description:
      "Structured student leadership programmes that build responsibility, discipline, service, and school spirit.",
  },
  {
    id: "faith-and-performing-arts",
    title: "Faith, Worship & Performing Arts",
    description:
      "Faith formation, worship support, music, dance, choirs, bands, and performance activities that enrich college life.",
  },
  {
    id: "sports-and-outdoor",
    title: "Sports, Scouts & Cadets",
    description:
      "Sports, scouting, cadet training, fitness, teamwork, and outdoor programmes that develop discipline and resilience.",
  },
  {
    id: "houses-coaches-and-trainers",
    title: "Houses, Coaches & Trainers",
    description:
      "House identity, inter-house participation, specialist coaching, and skill training for sports and performance groups.",
  },
];

const EXTRA_CURRICULAR_ACTIVITY_POSITION_CODES: Record<string, string[]> = {
  "english-literary-union-secondary": ["extra-english-literary-union-secondary"],
  "shakespeare-drama-unit": ["extra-shakespeare-drama-unit"],
  "debaters-club": ["extra-debaters-club"],
  "media-and-broadcasting-circle": ["extra-media-broadcasting-circle"],
  "speakers-guild": ["extra-speakers-guild"],
  "wall-mag-and-paper-articles": ["extra-wall-mag-paper-articles"],
  "english-literary-union-primary": ["extra-english-literary-union-primary"],
  "compering-and-drama-circle": ["extra-compering-drama-circle"],
  "wall-mag-committee": ["extra-wall-mag-committee"],
  "facebook-committee": ["extra-facebook-committee"],
  "speech-and-debate-circle": ["extra-speech-debate-circle"],
  "sinhala-literary-association": ["extra-sinhala-literary-association"],
  "debate-team": ["extra-debate-team"],
  "ignatian-society-for-charity": ["extra-ignatian-society-charity"],
  "western-band-girls": ["extra-western-band-girls"],
  "army-cadet-band-boys": ["extra-army-cadet-band-boys"],
  "oriental-band-girls": ["extra-oriental-band-girls"],
  "teachers-in-charge-of-prefects-senior": ["extra-prefects-senior-teacher-in-charge"],
  "teachers-in-charge-of-stewards": ["extra-stewards-teacher-in-charge"],
  "discipline-and-prefects-advisory-committee": ["extra-discipline-prefects-advisory-committee"],
  orchestra: ["extra-orchestra"],
  "bible-association": ["extra-bible-association"],
  scouts: ["extra-scouts"],
  "cub-scouts": ["extra-cub-scouts"],
  "singithi-scouts": ["extra-singithi-scouts"],
  "defence-cadet-boys": ["extra-defence-cadet-boys"],
  "defence-cadet-girls": ["extra-defence-cadet-girls"],
  "college-choir-western": ["extra-college-choir-western"],
  "altar-servers-association": ["extra-altar-servers-association"],
  "vocation-club": ["extra-vocation-club"],
  "liturgical-committee": ["extra-liturgical-committee"],
  "photography-and-media-unit": ["extra-photography-media-unit"],
  "thinking-circle": ["extra-thinking-circle"],
  "junior-red-cross-circle": ["extra-junior-red-cross-circle"],
  "social-grace-and-traffic-union": ["extra-social-grace-traffic-union"],
  "western-band-primary": ["extra-western-band-primary"],
  "liturgy-and-altar-servers-primary": ["extra-liturgy-altar-servers-primary"],
  "teachers-in-charge-of-prefects-primary": ["extra-prefects-primary-teacher-in-charge"],
  "college-choir-primary": ["extra-college-choir-primary"],
  dancing: ["extra-dancing"],
  "western-music": ["extra-western-music"],
  "eastern-music": ["extra-eastern-music"],
};

const EXTRA_CURRICULAR_ACTIVITY_BASE: ExtraCurricularActivity[] = [
  {
    id: "english-literary-union-secondary",
    groupId: "clubs-and-societies",
    title: "English Literary Union",
    note: "Secondary School",
    teachers: ["Rev. Fr. Mahima Gunawardena", "Mrs. Ranlie Fernando", "Mrs. Amila Roshini"],
  },
  {
    id: "shakespeare-drama-unit",
    groupId: "clubs-and-societies",
    title: "Shakespeare Drama Unit",
    teachers: ["Mrs. Ronisha Shelani", "Mr. Shelan Fernando"],
  },
  {
    id: "debaters-club",
    groupId: "clubs-and-societies",
    title: "Debaters' Club",
    teachers: ["Mrs. Ranlie Fernando", "Mrs. Shiromi Priyanka"],
  },
  {
    id: "media-and-broadcasting-circle",
    groupId: "clubs-and-societies",
    title: "Media & Broadcasting Circle",
    teachers: ["Mrs. Amila Roshini", "Mrs. Sachini Tharuka", "Mrs. Ronisha Shelani"],
  },
  {
    id: "speakers-guild",
    groupId: "clubs-and-societies",
    title: "Speakers' Guild",
    teachers: ["Mrs. Deshani Marasinghe", "Mrs. Darshini Suraweera", "Mr. Amantha Fernando"],
  },
  {
    id: "wall-mag-and-paper-articles",
    groupId: "clubs-and-societies",
    title: "Wall Mag & Paper Articles",
    teachers: ["Mr. Rasika Perera", "Mr. Merril Peiris"],
  },
  {
    id: "english-literary-union-primary",
    groupId: "clubs-and-societies",
    title: "English Literary Union",
    note: "Primary School",
    teachers: ["Rev. Fr. Asith Chamara", "Mrs. Amila Harshani", "Mrs. D. Geethanchali"],
  },
  {
    id: "compering-and-drama-circle",
    groupId: "clubs-and-societies",
    title: "Compering & Drama Circle",
    teachers: ["Mrs. D. Geethanchali", "Miss Amasha Perera"],
  },
  {
    id: "wall-mag-committee",
    groupId: "clubs-and-societies",
    title: "Wall Mag Committee",
    teachers: ["Mrs. Amila Harshani", "Miss Hashini Perera"],
  },
  {
    id: "facebook-committee",
    groupId: "clubs-and-societies",
    title: "Facebook Committee",
    teachers: ["Miss Hashini Perera", "Mrs. Amila Harshani", "Mrs. D. Geethanchali"],
  },
  {
    id: "speech-and-debate-circle",
    groupId: "clubs-and-societies",
    title: "Speech & Debate Circle",
    teachers: ["Mrs. Jayani Fernando", "Miss Chrishani Fernando"],
  },
  {
    id: "sinhala-literary-association",
    groupId: "clubs-and-societies",
    title: "Sinhala Literary Association",
    note: "A/L, Upper, Middle, and Primary sections",
    teachers: [
      "Rev. Fr. Asith Chamara",
      "Ms. Priyanga Mayadunne",
      "Mrs. Lasanthi Perera",
      "Mrs. Madusha Harshani",
      "Mrs. Anjela Fernando",
    ],
  },
  {
    id: "debate-team",
    groupId: "clubs-and-societies",
    title: "Debate Team",
    teachers: [
      "Rev. Fr. Kennedy Perera",
      "Mrs. Medhani Illangakoon",
      "Mrs. Lasanthi Perera",
      "Mr. Chaminda Randula",
    ],
  },
  {
    id: "ignatian-society-for-charity",
    groupId: "clubs-and-societies",
    title: "Ignatian Society for Charity",
    teachers: ["Rev. Fr. Mahima Gunawardena", "Mrs. Melon Fonseka", "Miss Kawshalya Kavindi"],
  },
  {
    id: "thinking-circle",
    groupId: "clubs-and-societies",
    title: "Thinking Circle",
    teachers: ["Rev. Fr. Kennedy Perera", "Mr. Sanjeewa Indrajith"],
  },
  {
    id: "junior-red-cross-circle",
    groupId: "clubs-and-societies",
    title: "Junior Red Cross Circle",
    teachers: ["Rev. Fr. Asith Chamara", "Mr. Sanjeewa Indrajith"],
  },
  {
    id: "social-grace-and-traffic-union",
    groupId: "clubs-and-societies",
    title: "Social Grace & Traffic Union",
    teachers: ["Rev. Fr. Asith Chamara", "Mr. Suresh Rathnasekara"],
  },
  {
    id: "photography-and-media-unit",
    groupId: "clubs-and-societies",
    title: "Photography & Media Unit",
    teachers: [
      "Rev. Fr. Mahima Gunawardena",
      "Mr. Ruwan Karunarathne",
      "Mr. Sanjeewa Indrajith",
      "Mrs. Roshina Fernando",
      "Miss Iroma Mendis",
      "Mrs. Asha Silva",
    ],
  },
  {
    id: "teachers-in-charge-of-prefects-senior",
    groupId: "leadership-and-service",
    title: "Teachers In Charge of Prefects",
    note: "Senior",
    teachers: [
      "Rev. Fr. Thilina Pathum",
      "Mr. Chaminda Randula",
      "Mr. Sanjeewa Indrajith",
      "Miss Nilika Lankani",
      "Miss Berny Fernando",
    ],
  },
  {
    id: "teachers-in-charge-of-stewards",
    groupId: "leadership-and-service",
    title: "Teachers In Charge of Stewards",
    teachers: [
      "Rev. Fr. Thilina Pathum",
      "Mr. Dilipa Jayasinghe",
      "Mr. Emil Jeewantha",
      "Mrs. Christina Sebastian",
    ],
  },
  {
    id: "discipline-and-prefects-advisory-committee",
    groupId: "leadership-and-service",
    title: "Discipline & Prefects Advisory Committee",
    teachers: [
      "Rev. Fr. Thilina Pathum",
      "Rev. Sr. Calistra Siyambalapitiya",
      "Mr. Neville Fernando",
      "Mr. Shelton Silva",
      "Mr. Suresh Rathnasekara",
      "Mr. Jinendra Fernando",
      "Mr. Chaminda Randula",
      "Mrs. Ruwini Perera",
      "Mrs. Nelum Wickramathunga",
    ],
  },
  {
    id: "teachers-in-charge-of-prefects-primary",
    groupId: "leadership-and-service",
    title: "Teachers In Charge of Prefects",
    note: "Primary School",
    teachers: ["Rev. Fr. Asith Chamara", "Mrs. Priyanthi Fernando", "Mrs. Niroshini Perera"],
  },
  {
    id: "orchestra",
    groupId: "faith-and-performing-arts",
    title: "Orchestra",
    teachers: ["Rev. Fr. Mahima Gunawardena", "Mr. Dileepa Jayasinghe", "Mr. Randika Lakmal"],
  },
  {
    id: "bible-association",
    groupId: "faith-and-performing-arts",
    title: "Bible Association",
    teachers: ["Rev. Fr. Mahima Gunawardena", "Rev. Sr. Malrani Fernando", "Mrs. Miurin Vijitha"],
  },
  {
    id: "western-band-girls",
    groupId: "faith-and-performing-arts",
    title: "Western Band",
    note: "Girls",
    teachers: ["Rev. Fr. Asith Chamara", "Miss Subashini Perera"],
  },
  {
    id: "army-cadet-band-boys",
    groupId: "faith-and-performing-arts",
    title: "Army Cadet Band",
    note: "Boys",
    teachers: ["Rev. Fr. Thilina Pathum", "Mr. Goyum Wathsala"],
  },
  {
    id: "oriental-band-girls",
    groupId: "faith-and-performing-arts",
    title: "Oriental Band",
    note: "Girls",
    teachers: ["Rev. Fr. Kennedy Perera", "Mrs. Saumya De Silva"],
  },
  {
    id: "college-choir-western",
    groupId: "faith-and-performing-arts",
    title: "College Choir",
    note: "Western",
    teachers: ["Rev. Fr. Mahima Gunawardena", "Mrs. Nilupuli Hettiarachchi", "Miss Hiruni Vass"],
  },
  {
    id: "altar-servers-association",
    groupId: "faith-and-performing-arts",
    title: "Altar Servers' Association",
    teachers: [
      "Rev. Fr. Asith Chamara",
      "Rev. Sr. Calistra Siyambalapitiya",
      "Rev. Sr. Malrani Fernando",
      "Miss Iroma Mendis",
    ],
  },
  {
    id: "vocation-club",
    groupId: "faith-and-performing-arts",
    title: "Vocation Club",
    teachers: ["Rev. Fr. Thilina Pathum", "Rev. Sr. Malrani Fernando", "Mrs. Ruwini Perera"],
  },
  {
    id: "liturgical-committee",
    groupId: "faith-and-performing-arts",
    title: "Liturgical Committee",
    teachers: [
      "Rev. Fr. Mahima Gunawardena",
      "Rev. Sr. Calistra Siyambalapitiya",
      "Rev. Sr. Malrani Fernando",
      "Rev. Sr. Diyensili Pushparajah",
      "Rev. Sr. Anushka Fernando",
      "Mrs. Miurin Vijitha",
      "Mrs. Madusha Harshani",
      "Miss Iroma Mendis",
    ],
  },
  {
    id: "western-band-primary",
    groupId: "faith-and-performing-arts",
    title: "Western Band",
    note: "Primary School",
    teachers: ["Rev. Fr. Asith Chamara", "Mrs. Tharushi Panapitiya", "Mrs. Nelum Wickramathunga"],
  },
  {
    id: "liturgy-and-altar-servers-primary",
    groupId: "faith-and-performing-arts",
    title: "Liturgy & In-Charge of Altar Servers",
    note: "Primary School",
    teachers: ["Rev. Fr. Asith Chamara", "Miss Iroma Mendis", "Mrs. Priyangika Perera"],
  },
  {
    id: "college-choir-primary",
    groupId: "faith-and-performing-arts",
    title: "College Choir",
    note: "Primary School",
    teachers: ["Rev. Fr. Asith Chamara", "Mrs. Tharushi Panapitiya", "Mrs. Jayani Fernando"],
  },
  {
    id: "dancing",
    groupId: "faith-and-performing-arts",
    title: "Dancing",
    teachers: ["Mrs. Sugandi Fernando", "Mrs. Saumya De Silva"],
  },
  {
    id: "western-music",
    groupId: "faith-and-performing-arts",
    title: "Western Music",
    teachers: ["Mrs. Tharushi Panapitiya", "Mrs. Nishani Perera"],
  },
  {
    id: "eastern-music",
    groupId: "faith-and-performing-arts",
    title: "Eastern Music",
    teachers: ["Mr. Goyum Wathsala", "Mr. Dileepa Jayasinghe"],
  },
  {
    id: "scouts",
    groupId: "sports-and-outdoor",
    title: "Scouts",
    teachers: ["Rev. Fr. Asith Chamara", "Mrs. Sumihiri Kariyakarawana", "Mrs. Pradeepa Fernando"],
  },
  {
    id: "cub-scouts",
    groupId: "sports-and-outdoor",
    title: "Cub Scouts",
    teachers: [
      "Rev. Fr. Asith Chamara",
      "Mrs. Sumihiri Kariyakarawana",
      "Mrs. Niroshani Perera",
      "Miss Dhananjani Perera",
      "Miss Hashini Perera",
      "Miss Chrishani Fernando",
    ],
  },
  {
    id: "singithi-scouts",
    groupId: "sports-and-outdoor",
    title: "Singithi Scouts",
    teachers: [
      "Mrs. Disna Fonseka",
      "Mrs. Sumihiri Kariyakarawana",
      "Mrs. Amila Harshani",
      "Mrs. Dinoly Silva",
      "Mrs. Hasara Fernando",
    ],
  },
  {
    id: "defence-cadet-boys",
    groupId: "sports-and-outdoor",
    title: "Defence Cadet",
    note: "Boys",
    teachers: ["Rev. Fr. Thilina Pathum", "Mr. Suresh Rathnasekara"],
  },
  {
    id: "defence-cadet-girls",
    groupId: "sports-and-outdoor",
    title: "Defence Cadet",
    teachers: [],
    note: "Girls",
  },
  {
    id: "sports-committee-leadership",
    groupId: "sports-and-outdoor",
    title: "Sports Committee Leadership",
    note: "Rector and Prefect of Games",
    teachers: ["Rev. Fr. Kennedy Perera", "Rev. Fr. Thilina Pathum"],
  },
  {
    id: "athletics",
    groupId: "sports-and-outdoor",
    title: "Athletics",
    teachers: ["Mr. Rusiru Thejaka", "Mrs. Primrose Neris"],
  },
  {
    id: "cricket",
    groupId: "sports-and-outdoor",
    title: "Cricket",
    teachers: ["Mr. Dinesh Tharaka"],
  },
  {
    id: "cricket-academy",
    groupId: "sports-and-outdoor",
    title: "Cricket Academy",
    teachers: ["Mr. Dinesh Tharaka"],
  },
  {
    id: "volleyball",
    groupId: "sports-and-outdoor",
    title: "Volleyball",
    teachers: ["Mr. Dinesh Tharaka"],
  },
  {
    id: "basketball",
    groupId: "sports-and-outdoor",
    title: "Basketball",
    teachers: [],
    note: "Team Sport",
  },
  {
    id: "karate",
    groupId: "sports-and-outdoor",
    title: "Karate",
    teachers: ["Mr. Rusiru Thejaka"],
  },
  {
    id: "swimming",
    groupId: "sports-and-outdoor",
    title: "Swimming",
    teachers: ["Mrs. Anoma Pathirana"],
  },
  {
    id: "chess",
    groupId: "sports-and-outdoor",
    title: "Chess",
    teachers: ["Mr. Dinesh Tharaka"],
  },
  {
    id: "anthony-house-upper",
    groupId: "houses-coaches-and-trainers",
    title: "Anthony House",
    note: "Upper School",
    teachers: ["Mr. Gayan Upendra", "Mrs. Ronisha Shelani"],
  },
  {
    id: "kingsley-house-upper",
    groupId: "houses-coaches-and-trainers",
    title: "Kingsley House",
    note: "Upper School",
    teachers: ["Mr. Shehan Fernandopulle", "Mrs. Dinesha Herath"],
  },
  {
    id: "sebastian-house-upper",
    groupId: "houses-coaches-and-trainers",
    title: "Sebastian House",
    note: "Upper School",
    teachers: ["Mr. Vohan Sandeep", "Mrs. Arosha Fernando"],
  },
  {
    id: "anthony-house-primary",
    groupId: "houses-coaches-and-trainers",
    title: "Anthony House",
    note: "Primary School",
    teachers: ["Mrs. Hasara Fernando", "Miss Maleesha Nethmini"],
  },
  {
    id: "kingsley-house-primary",
    groupId: "houses-coaches-and-trainers",
    title: "Kingsley House",
    note: "Primary School",
    teachers: ["Mrs. Geethanchali Perera", "Miss Amasha Sandeepani"],
  },
  {
    id: "sebastian-house-primary",
    groupId: "houses-coaches-and-trainers",
    title: "Sebastian House",
    note: "Primary School",
    teachers: ["Miss Iroma Mendis", "Mrs. Ishani Fernando"],
  },
  {
    id: "athletics-coaches",
    groupId: "houses-coaches-and-trainers",
    title: "Athletic Coaches",
    teachers: ["Mr. Christopher Pulle", "Mr. Shashika Madushanka", "Mr. Rusiru Thejaka"],
  },
  {
    id: "cricket-coaches-under-13-15",
    groupId: "houses-coaches-and-trainers",
    title: "Cricket Coaches",
    note: "Under 13 & 15",
    teachers: ["Mr. Mithun Perera"],
  },
  {
    id: "cricket-coaches-under-17-19",
    groupId: "houses-coaches-and-trainers",
    title: "Cricket Coaches",
    note: "Under 17 & 19",
    teachers: ["Mr. Harshana Lakmal"],
  },
  {
    id: "cricket-academy-coach",
    groupId: "houses-coaches-and-trainers",
    title: "Cricket Academy Coach",
    teachers: ["Mr. Mithun Perera"],
  },
  {
    id: "volleyball-coach",
    groupId: "houses-coaches-and-trainers",
    title: "Volleyball Coach",
    teachers: ["Mr. Samansiri Senevirathne"],
  },
  {
    id: "basketball-coaches",
    groupId: "houses-coaches-and-trainers",
    title: "Basketball Coaches",
    teachers: ["Mr. Kithsiri", "Mr. Shen"],
  },
  {
    id: "karate-coach",
    groupId: "houses-coaches-and-trainers",
    title: "Karate Coach",
    teachers: ["Mr. Randika Dilshan"],
  },
  {
    id: "swimming-coaches",
    groupId: "houses-coaches-and-trainers",
    title: "Swimming Coaches",
    teachers: ["Mr. Sumith Ranasinghe", "Mr. Lakshan Fernando", "Mrs. Stephni Fernando"],
  },
  {
    id: "scouting-trainer",
    groupId: "houses-coaches-and-trainers",
    title: "Scouting Trainer",
    teachers: ["Mrs. Sumihiri Kariyakarawana"],
  },
  {
    id: "boys-band-trainer",
    groupId: "houses-coaches-and-trainers",
    title: "Boys' Band Trainer",
    teachers: ["Mr. Sampath Fernando"],
  },
  {
    id: "girls-band-trainers",
    groupId: "houses-coaches-and-trainers",
    title: "Girls' Band Trainers",
    teachers: ["Mr. Nishantha Akmeemana", "Mr. Sameera Akmeemana"],
  },
  {
    id: "primary-band-trainer",
    groupId: "houses-coaches-and-trainers",
    title: "Primary Band Trainer",
    teachers: ["Mr. Nishantha Akmeemana"],
  },
  {
    id: "army-cadet-trainer",
    groupId: "houses-coaches-and-trainers",
    title: "Army Cadet Trainer",
    teachers: ["Mr. Amila Ranaweera"],
  },
  {
    id: "eastern-band-trainer",
    groupId: "houses-coaches-and-trainers",
    title: "Eastern Band Trainer",
    teachers: ["Mrs. Saumya De Silva"],
  },
];

export const EXTRA_CURRICULAR_ACTIVITIES: ExtraCurricularActivity[] =
  EXTRA_CURRICULAR_ACTIVITY_BASE.map((activity) => ({
    ...activity,
    positionCodes: EXTRA_CURRICULAR_ACTIVITY_POSITION_CODES[activity.id] || [],
  }));

export const EXTRA_CURRICULAR_HOME_FEATURED_IDS = [
  "photography-and-media-unit",
  "english-literary-union-secondary",
  "sinhala-literary-association",
  "teachers-in-charge-of-prefects-senior",
  "bible-association",
  "scouts",
];

const EXTRA_CURRICULAR_GROUP_IDS = new Set(EXTRA_CURRICULAR_GROUPS.map((group) => group.id));

export function extraCurricularActivitySlug(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "activity";
}

function normalizeCustomActivity(
  activity: Partial<ExtraCurricularActivity> | null | undefined,
): ExtraCurricularActivity | null {
  const title = typeof activity?.title === "string" ? activity.title.trim() : "";
  if (!title) return null;

  const id =
    typeof activity?.id === "string" && activity.id.trim()
      ? extraCurricularActivitySlug(activity.id)
      : `custom-${extraCurricularActivitySlug(title)}`;
  const groupId =
    typeof activity?.groupId === "string" && EXTRA_CURRICULAR_GROUP_IDS.has(activity.groupId)
      ? activity.groupId
      : "clubs-and-societies";
  const teachers = Array.isArray(activity?.teachers)
    ? activity.teachers.map((teacher) => String(teacher || "").trim()).filter(Boolean)
    : [];
  const positionCodes = Array.isArray(activity?.positionCodes)
    ? activity.positionCodes.map((code) => String(code || "").trim()).filter(Boolean)
    : [];

  return {
    id,
    groupId,
    title,
    teachers,
    note: typeof activity?.note === "string" ? activity.note.trim() : "",
    positionCodes,
    visible: activity?.visible !== false,
  };
}

export function extraCurricularActivities(
  customActivities: Partial<ExtraCurricularActivity>[] = [],
) {
  const builtInIds = new Set(EXTRA_CURRICULAR_ACTIVITIES.map((activity) => activity.id));
  const custom = customActivities
    .map(normalizeCustomActivity)
    .filter((activity): activity is ExtraCurricularActivity => Boolean(activity))
    .filter((activity) => activity.visible !== false && !builtInIds.has(activity.id));

  const seen = new Set<string>();
  return [...EXTRA_CURRICULAR_ACTIVITIES, ...custom].filter((activity) => {
    if (seen.has(activity.id)) return false;
    seen.add(activity.id);
    return true;
  });
}

export function extraCurricularActivityById(
  id: string,
  customActivities: Partial<ExtraCurricularActivity>[] = [],
) {
  return extraCurricularActivities(customActivities).find((activity) => activity.id === id) || null;
}

export function extraCurricularActivitiesByGroup(
  groupId: string,
  customActivities: Partial<ExtraCurricularActivity>[] = [],
) {
  return extraCurricularActivities(customActivities).filter((activity) => activity.groupId === groupId);
}
