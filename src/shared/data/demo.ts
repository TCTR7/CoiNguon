export interface Person {
  id: string;
  name: string;
  initials: string;
  generation: string;
  years: string;
  role: string;
  branch: string;
  deceased: boolean;
}
export const people: Person[] = [
  {
    id: 'tran-van-an',
    name: 'Trần Văn An',
    initials: 'A',
    generation: 'Đời thứ ba',
    years: '1932 – 2018',
    role: 'Ông nội',
    branch: 'Chi trưởng',
    deceased: true,
  },
  {
    id: 'nguyen-thi-lan',
    name: 'Nguyễn Thị Lan',
    initials: 'L',
    generation: 'Đời thứ ba',
    years: '1936 – 2021',
    role: 'Bà nội',
    branch: 'Chi trưởng',
    deceased: true,
  },
  {
    id: 'tran-minh-duc',
    name: 'Trần Minh Đức',
    initials: 'Đ',
    generation: 'Đời thứ tư',
    years: 'Sinh năm 1962',
    role: 'Bố',
    branch: 'Chi trưởng',
    deceased: false,
  },
  {
    id: 'le-thi-hoa',
    name: 'Lê Thị Hòa',
    initials: 'H',
    generation: 'Đời thứ tư',
    years: 'Sinh năm 1965',
    role: 'Mẹ',
    branch: 'Chi trưởng',
    deceased: false,
  },
  {
    id: 'tran-thu-ha',
    name: 'Trần Thu Hà',
    initials: 'H',
    generation: 'Đời thứ tư',
    years: 'Sinh năm 1968',
    role: 'Cô',
    branch: 'Chi thứ',
    deceased: false,
  },
  {
    id: 'tran-minh-khoi',
    name: 'Trần Minh Khôi',
    initials: 'K',
    generation: 'Đời thứ năm',
    years: 'Sinh năm 1992',
    role: 'Cháu nội',
    branch: 'Chi trưởng',
    deceased: false,
  },
  {
    id: 'tran-ngoc-mai',
    name: 'Trần Ngọc Mai',
    initials: 'M',
    generation: 'Đời thứ năm',
    years: 'Sinh năm 1996',
    role: 'Cháu nội',
    branch: 'Chi trưởng',
    deceased: false,
  },
];
export const demoEvent = {
  title: 'Ngày giỗ ông Trần Văn An',
  date: '08 tháng 11, 2026',
  time: '10:00',
  address: 'Nhà từ đường · Làng An Hòa',
  host: 'Trần Minh Đức',
};
export const members = [
  { name: 'Trần Minh Đức', role: 'Quản trị viên', initials: 'Đ' },
  { name: 'Trần Minh Khôi', role: 'Biên tập viên', initials: 'K' },
  { name: 'Trần Ngọc Mai', role: 'Thành viên', initials: 'M' },
];
