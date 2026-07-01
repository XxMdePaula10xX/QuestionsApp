# Força a assinatura MANUAL no target "App" do projeto iOS (Capacitor), lendo o
# provisioning profile que o Codemagic baixou. Resolve o erro de archive
# "App requires a provisioning profile" quando `xcode-project use-profiles`
# não grava as build settings no target (Xcode recente + template Capacitor).
#
# Roda no CI (Codemagic macOS) DEPOIS de `app-store-connect fetch-signing-files`:
#   gem install xcodeproj && ruby resources/set_ios_signing.rb
require 'xcodeproj'
require 'tmpdir'

profiles_dir = File.expand_path('~/Library/MobileDevice/Provisioning Profiles')
profile = Dir.glob(File.join(profiles_dir, '*.mobileprovision')).max_by { |f| File.mtime(f) }
abort("Nenhum provisioning profile em #{profiles_dir}") unless profile

# Decodifica o .mobileprovision (plist assinado) e extrai Nome/UUID/Team.
plist = File.join(Dir.tmpdir, 'profile.plist')
system("security cms -D -i '#{profile}' -o '#{plist}'") || abort('Falha ao decodificar o profile')
name = `/usr/libexec/PlistBuddy -c 'Print :Name' '#{plist}'`.strip
uuid = `/usr/libexec/PlistBuddy -c 'Print :UUID' '#{plist}'`.strip
team = `/usr/libexec/PlistBuddy -c 'Print :TeamIdentifier:0' '#{plist}'`.strip
abort('Não consegui extrair nome/team do profile') if name.empty? || team.empty?
puts "Profile: #{name} (#{uuid}) — team #{team}"

project = Xcodeproj::Project.open('ios/App/App.xcodeproj')
target = project.targets.find { |t| t.name == 'App' }
abort('Target "App" não encontrado') unless target

target.build_configurations.each do |cfg|
  cfg.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  cfg.build_settings['DEVELOPMENT_TEAM'] = team
  cfg.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = name
  cfg.build_settings['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
  cfg.build_settings['CODE_SIGN_IDENTITY[sdk=iphoneos*]'] = 'Apple Distribution'
end
project.save
puts 'Assinatura manual aplicada ao target "App" (Debug + Release).'
