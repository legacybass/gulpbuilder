module.exports.GenerateTemplateString = function(template, map) {
	var sanitized = template.replace(/\$\{([\s]*[^;\s]+[\s]*)\}/g, (_, match) => {
		return `\$\{map.${match.trim()}\}`;
	})
	.replace(/(\$\{(?!map\.)[^}]+\})/g, '');
	return eval('`' + sanitized + '`');
};