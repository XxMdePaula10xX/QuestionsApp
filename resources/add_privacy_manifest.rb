# Adiciona o PrivacyInfo.xcprivacy ao target "App" do projeto iOS (Capacitor),
# garantindo que ele entre no bundle (só copiar o arquivo NÃO basta — a Apple
# exige o Privacy Manifest no app). Rodado no CI (Codemagic macOS) via:
#   gem install xcodeproj && ruby resources/add_privacy_manifest.rb
require 'xcodeproj'

project_path = 'ios/App/App.xcodeproj'
abort("Projeto iOS não encontrado em #{project_path}") unless File.exist?(project_path)

project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == 'App' }
abort('Target "App" não encontrado') unless target

already = target.resources_build_phase.files.any? do |f|
  f.file_ref && f.file_ref.path.to_s.include?('PrivacyInfo.xcprivacy')
end

if already
  puts 'PrivacyInfo.xcprivacy já está no target — nada a fazer.'
else
  app_group = project.main_group.find_subpath('App', true)
  ref = app_group.new_reference('PrivacyInfo.xcprivacy')
  target.add_resources([ref])
  project.save
  puts 'PrivacyInfo.xcprivacy adicionado ao target "App".'
end
