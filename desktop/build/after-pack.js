/* sets the HelixBoard icon and version details on HelixBoard.exe without needing Wine (so the Windows build also works from macOS/Linux) */
const path = require('path');
const fs = require('fs');
const ResEdit = require('resedit');

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const info = ctx.packager.appInfo;
  const exe = path.join(ctx.appOutDir, info.productFilename + '.exe');
  const PE = ResEdit.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(PE);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, ico.icons.map(i => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  const [a, b, c] = info.version.split('.').map(Number);
  vi.setFileVersion(a, b, c, 0, 1033);
  vi.setProductVersion(a, b, c, 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'HelixBoard By Mr. Hany Taha',
    ProductName: 'HelixBoard By Mr. Hany Taha',
    CompanyName: 'Mr. Hany Taha',
    LegalCopyright: '© Mr. Hany Taha',
    OriginalFilename: info.productFilename + '.exe',
    InternalName: 'HelixBoard',
  });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(PE);
  fs.writeFileSync(exe, Buffer.from(PE.generate()));
  console.log('  • HelixBoard icon and version info written to', path.basename(exe));
};
