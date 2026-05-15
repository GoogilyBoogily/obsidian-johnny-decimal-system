import type JohnnyDecimalPlugin from '../main';
import {registerValidateCommand} from './validate';
import {registerCreateSystemCommand} from './create-system';
import {registerCreateAreaCommand} from './create-area';
import {registerCreateCategoryCommand} from './create-category';
import {registerCreateIdCommand} from './create-id';
import {registerNavigateCommand} from './navigate';
import {registerGenerateJdexCommand} from './generate-jdex';
import {registerRemovePrefixesCommand} from './remove-prefixes';
import {registerAuditCommand} from './audit';

export function registerCommands(plugin: JohnnyDecimalPlugin) {
	registerValidateCommand(plugin);
	registerCreateSystemCommand(plugin);
	registerCreateAreaCommand(plugin);
	registerCreateCategoryCommand(plugin);
	registerCreateIdCommand(plugin);
	registerNavigateCommand(plugin);
	registerGenerateJdexCommand(plugin);
	registerRemovePrefixesCommand(plugin);
	registerAuditCommand(plugin);
}
