import React from 'react';
import ReactTable from 'react-table';
import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog';
import { PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import { Dropdown } from 'office-ui-fabric-react/lib/Dropdown';
import { ProgressIndicator } from 'office-ui-fabric-react/lib/ProgressIndicator';

import { ItemDisplay } from './ItemDisplay';
import UserStore from './Styles';

import STTApi from 'sttapi';
import { CONFIG, replicatorCurrencyCost, replicatorFuelCost, canReplicate, replicatorFuelValue, canUseAsFuel, replicate } from 'sttapi';

export class ReplicatorDialog extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			showDialog: false,
			fuellist: [],
			fueltank: [],
			fuelTankValue: 0,
			fuelCost: 1000,
			fuelconfig: 'extraSchematics',
			targetArchetype: undefined
		};

		this._closeDialog = this._closeDialog.bind(this);
		this.show = this.show.bind(this);
	}

	show(targetArchetype) {
		let currencyCost = replicatorCurrencyCost(targetArchetype.id, targetArchetype.rarity);
		let fuelCost = replicatorFuelCost(targetArchetype.type, targetArchetype.rarity);
		let canBeReplicated = canReplicate(targetArchetype.id);

		this.setState({
			showDialog: true,
			currencyCost,
			fuelCost,
			canBeReplicated,
			targetArchetype
		});

		this._reloadItems();
	}

	_closeDialog() {
		this.setState({
			showDialog: false,
			fuelTankValue: 0,
			fueltank: [],
			targetArchetype: undefined
		});
	}

	_reloadItems() {
		if (this.state.fuelconfig === 'extraSchematics') {
			let playerSchematics = STTApi.playerData.character.items.filter(item => item.type === 8);

			let fuellist = [];
			STTApi.ships.forEach(ship => {
				if (ship.level === ship.max_level) {
					const schematic = STTApi.shipSchematics.find(schematic => schematic.ship.archetype_id === ship.archetype_id);
					if (schematic) {
						const playerSchematic = playerSchematics.find(playerSchematic => playerSchematic.archetype_id === schematic.id);

						if (playerSchematic) {
							fuellist.push(playerSchematic);
						}
					}
				}
			});

			this.setState({ fuellist });
		} else if (this.state.fuelconfig === 'extraItems') {
			let equipmentAlreadyOnCrew = new Set();
			STTApi.roster.forEach(crew => {
				if (crew.buyback) {
					return;
				}

				// Comment this line if we want to be more aggressive (with potentially more false positives for in-progress crew)
				if (crew.level < 100) {
					return;
				}

				let lastEquipmentLevel = crew.level;
				for (let equipment of crew.equipment_slots) {
					if (!equipment.have) {
						lastEquipmentLevel = equipment.level;
					}
				}

				let feCrew = STTApi.allcrew.find(c => c.symbol === crew.symbol);
				if (feCrew) {
					feCrew.equipment_slots.forEach(equipment => {
						if (equipment.level < lastEquipmentLevel) {
							equipmentAlreadyOnCrew.add(equipment.archetype);
						}
					});
				}
			});

			let fuellist = STTApi.playerData.character.items.filter(
				item => equipmentAlreadyOnCrew.has(item.archetype_id) && item.quantity === 1 && item.rarity > 1
			);
			this.setState({ fuellist });
		} else if (this.state.fuelconfig === 'everything') {
			let fuellist = STTApi.playerData.character.items;
			this.setState({ fuellist });
		} else {
			this.setState({ fuellist: [] });
		}
	}

	_removeFromTank(fuel) {
		let currentTank = this.state.fueltank;
		currentTank.splice(currentTank.indexOf(fuel), 1);

		let fuelValue = this.state.fuelTankValue - replicatorFuelValue(fuel.type, fuel.rarity) * fuel.quantity;

		this.setState({
			fueltank: currentTank,
			fuelTankValue: fuelValue
		});
	}

	_autoFill() {
		let neededFuelCost = this.state.fuelCost - this.state.fuelTankValue;
		let currentTank = this.state.fueltank;

		if (neededFuelCost <= 0) {
			return;
		}

		for (let item of this.state.fuellist) {
			if (neededFuelCost <= 0) {
				break;
			}

			if (canUseAsFuel(item.id)) {
				let fuelValue = replicatorFuelValue(item.type, item.rarity);

				let neededQuantity = Math.ceil(neededFuelCost / fuelValue);
				if (item.quantity > neededQuantity) {
					currentTank.push({
						name: item.name,
						iconUrl: item.iconUrl,
						quantity: neededQuantity,
						// Not for display
						id: item.id,
						type: item.type,
						rarity: item.rarity
					});

					break;
				} else {
					// Add all of it, and keep going through the list
					currentTank.push({
						name: item.name,
						iconUrl: item.iconUrl,
						quantity: item.quantity,
						// Not for display
						id: item.id,
						type: item.type,
						rarity: item.rarity
					});

					neededFuelCost -= fuelValue * item.quantity;
				}
			}
		}

		// Calculate value
		let fuelValue = 0;
		for (let fuel of currentTank) {
			fuelValue += replicatorFuelValue(fuel.type, fuel.rarity) * fuel.quantity;
		}

		this.setState({
			fueltank: currentTank,
			fuelTankValue: fuelValue
		});
	}

	render() {
		if (!this.state.showDialog) {
			return <span />;
		}

		let currentTheme = UserStore.get('theme');

		return (
			<Dialog
				hidden={!this.state.showDialog}
				onDismiss={this._closeDialog}
				dialogContentProps={{
					type: DialogType.normal,
					title: `Replicate one ${CONFIG.RARITIES[this.state.targetArchetype.rarity].name} ${this.state.targetArchetype.name}`
				}}
				modalProps={{
					containerClassName: 'replicatordialogMainOverride',
					isBlocking: true
				}}>
				<div
					style={{
						minWidth: '800px',
						color: currentTheme.semanticColors.bodyText,
						backgroundColor: currentTheme.semanticColors.bodyBackground
					}}>
					{!this.state.canBeReplicated && (
						<p>
							<b>This item cannot be replicated!</b>
						</p>
					)}
					<div style={{ color: 'red' }}>
						The actual replicator functionality is not implemented yet. Feel free to browse the tables on the left for inspiration though.
					</div>

					<div
						style={{
							display: 'grid',
							gridTemplateColumns: '9fr 7fr',
							gridGap: '6px',
							gridTemplateAreas: `'fuelconfig fueltank' 'fuellist fueltank' 'fuellist details'`
						}}>
						<div style={{ gridArea: 'fuelconfig', display: 'grid', gridTemplateColumns: '2fr 1fr' }}>
							<Dropdown
								selectedKey={this.state.fuelconfig}
								onChange={(evt, item) => {
									this.setState({ fuelconfig: item.key }, () => {
										this._reloadItems();
									});
								}}
								placeHolder='What kind of items?'
								options={[
									{ key: 'extraSchematics', text: 'Unneeded ship schematics' },
									{ key: 'extraItems', text: 'Potentially unneeded items' },
									{ key: 'everything', text: 'All items' }
								]}
							/>
							<DefaultButton onClick={() => this._autoFill()} text='Auto fill >' />
						</div>
						<div style={{ gridArea: 'fuellist' }}>
							<ReactTable
								data={this.state.fuellist}
								columns={[
									{
										id: 'icon',
										Header: '',
										minWidth: 50,
										maxWidth: 50,
										resizable: false,
										sortable: false,
										accessor: 'name',
										Cell: p => <ItemDisplay src={p.original.iconUrl} size={50} maxRarity={p.original.rarity} rarity={p.original.rarity} />
									},
									{
										id: 'name',
										Header: 'Name',
										minWidth: 90,
										maxWidth: 180,
										resizable: true,
										accessor: 'name'
									},
									{
										id: 'quantity',
										Header: 'Quantity',
										minWidth: 40,
										maxWidth: 60,
										resizable: true,
										accessor: 'quantity'
									},
									{
										id: 'burncount',
										Header: 'Use as fuel',
										minWidth: 120,
										maxWidth: 140,
										sortable: false,
										resizable: true,
										Cell: row => (
											<div className='ui action input' style={{ width: '100px' }}>
												<input type='text' placeholder='Count...' />
												<button className='ui icon button'>
													<i className='angle double right icon' />
												</button>
											</div>
										)
									}
								]}
								showPageSizeOptions={false}
								defaultPageSize={this.state.fuellist.length <= 50 ? this.state.fuellist.length : 50}
								pageSize={this.state.fuellist.length <= 50 ? this.state.fuellist.length : 50}
								showPagination={this.state.fuellist.length > 50}
								className='-striped -highlight'
								style={{ height: '300px' }}
							/>
						</div>
						<div style={{ gridArea: 'fueltank' }}>
							<ReactTable
								data={this.state.fueltank}
								defaultPageSize={this.state.fueltank.length <= 50 ? this.state.fueltank.length : 50}
								pageSize={this.state.fueltank.length <= 50 ? this.state.fueltank.length : 50}
								columns={[
									{
										id: 'icon',
										Header: '',
										minWidth: 50,
										maxWidth: 50,
										resizable: false,
										sortable: false,
										accessor: 'name',
										Cell: p => <ItemDisplay src={p.original.iconUrl} size={50} maxRarity={p.original.rarity} rarity={p.original.rarity} />
									},
									{
										id: 'name',
										Header: 'Name',
										minWidth: 90,
										maxWidth: 180,
										resizable: true,
										accessor: 'name'
									},
									{
										id: 'quantity',
										Header: 'Burn quantity',
										minWidth: 40,
										maxWidth: 60,
										resizable: true,
										accessor: 'quantity'
									},
									{
										id: 'remove',
										Header: 'Remove',
										minWidth: 50,
										maxWidth: 50,
										sortable: false,
										resizable: true,
										Cell: row => (
											<button className='ui icon button' onClick={() => this._removeFromTank(row.original)}>
												<i className='icon close' />
											</button>
										)
									}
								]}
								showPagination={false}
								showPageSizeOptions={false}
								className='-striped -highlight'
								style={{ height: '280px' }}
							/>
							<ProgressIndicator
								description={`Fuel: ${this.state.fuelTankValue} of ${this.state.fuelCost}`}
								percentComplete={(this.state.fuelTankValue * 100) / this.state.fuelCost}
							/>
						</div>
						<div style={{ gridArea: 'details' }}>
							<p>Cost: {this.state.currencyCost} credits</p>
						</div>
					</div>
				</div>

				<DialogFooter>
					<PrimaryButton
						onClick={this._closeDialog}
						text='Replicate'
						disabled={this.state.canBeReplicated && this.state.fuelTankValue < this.state.fuelCost}
					/>
					<DefaultButton onClick={this._closeDialog} text='Cancel' />
				</DialogFooter>
			</Dialog>
		);
	}
}
